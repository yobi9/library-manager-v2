; folder-picker-agent.ahk
; AutoHotkey v2 - Minimal native folder picker / opener tool
; HTTP server on http://127.0.0.1:5199/pick-folder and /open-folder

#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

PORT := 5199
BIND_ADDR := "127.0.0.1"
RUNNING := true

; Initialize WinSock
WSADATA := Buffer(394 + A_PtrSize)
if DllCall("ws2_32\WSAStartup", "UShort", 0x0202, "Ptr", WSADATA) != 0
{
    MsgBox "Failed to initialize WinSock"
    ExitApp 1
}

; Create TCP socket
hSocket := DllCall("ws2_32\socket", "Int", 2, "Int", 1, "Int", 0, "UPtr")
if hSocket = -1 || hSocket = 0
{
    DllCall("ws2_32\WSACleanup")
    MsgBox "Failed to create socket"
    ExitApp 1
}

; Allow address reuse
opt := 1
DllCall("ws2_32\setsockopt", "UPtr", hSocket, "Int", 1, "Int", 4, "Int*", &opt, "Int", 4)

; Bind to 127.0.0.1:PORT
sockaddr := Buffer(16)
AddrInet(sockaddr, BIND_ADDR, PORT)
if DllCall("ws2_32\bind", "UPtr", hSocket, "Ptr", sockaddr, "Int", 16) != 0
{
    DllCall("ws2_32\closesocket", "UPtr", hSocket)
    DllCall("ws2_32\WSACleanup")
    MsgBox "Cannot bind to " BIND_ADDR ":" PORT ". Check port availability."
    ExitApp 1
}

; Listen
if DllCall("ws2_32\listen", "UPtr", hSocket, "Int", 5) != 0
{
    DllCall("ws2_32\closesocket", "UPtr", hSocket)
    DllCall("ws2_32\WSACleanup")
    MsgBox "Failed to listen on port " PORT
    ExitApp 1
}

; Set non-blocking mode
flag := 1
DllCall("ws2_32\ioctlsocket", "UPtr", hSocket, "UInt", 0x8004667E, "UInt*", flag)

; إخفاء أيقونة شريط المهام (جنب الساعة) — السكربت يعمل في الخلفية بدون أيقونة.
A_IconHidden := true

OnExit Cleanup

; Main accept loop
while RUNNING
{
    hClient := DllCall("ws2_32\accept", "UPtr", hSocket, "Ptr", 0, "Ptr", 0, "UPtr")
    if hClient != -1 && hClient != 0
    {
        buf := Buffer(4096)
        bytesRead := DllCall("ws2_32\recv", "UPtr", hClient, "Ptr", buf, "Int", 4095, "Int", 0, "Int")
        if bytesRead > 0
        {
            request := StrGet(buf, bytesRead, "UTF-8")
            HandleRequest(hClient, request)
        }
        else
        {
            SendHttpResponse(hClient, 400, "Bad Request", '{"error":"Empty request"}')
        }
        DllCall("ws2_32\closesocket", "UPtr", hClient)
    }
    Sleep 200
}

Cleanup(*)
{
    if hSocket
        DllCall("ws2_32\closesocket", "UPtr", hSocket)
    DllCall("ws2_32\WSACleanup")
}

; ---------- Request Handler ----------

HandleRequest(hClient, req)
{
    ; Parse first line: GET /pick-folder HTTP/1.1
    newlinePos := InStr(req, "`r`n")
    if !newlinePos
        newlinePos := InStr(req, "`n")
    if !newlinePos
    {
        SendHttpResponse(hClient, 400, "Bad Request", '{"error":"Invalid request"}')
        return
    }

    firstLine := SubStr(req, 1, newlinePos - 1)
    parts := StrSplit(firstLine, " ")
    if parts.Length < 2
    {
        SendHttpResponse(hClient, 400, "Bad Request", '{"error":"Invalid request line"}')
        return
    }

    method := parts[1]
    target := parts[2]

    ; Split request target into route + optional query string.
    route := target
    query := ""
    qPos := InStr(target, "?")
    if qPos
    {
        route := SubStr(target, 1, qPos - 1)
        query := SubStr(target, qPos + 1)
    }

    if method = "GET" && route = "/pick-folder"
    {
        selectedPath := ShowModernFolderDialog()
        if selectedPath != ""
        {
            json := '{"path":"' EscapeJsonStr(selectedPath) '"}'
            SendHttpResponse(hClient, 200, "OK", json, "application/json")
        }
        else
        {
            SendHttpResponse(hClient, 204, "No Content")
        }
    }
    else if method = "GET" && route = "/open-folder"
    {
        ; Open a given folder (UNC or local) on the client machine in Explorer.
        ; The path parameter must be fully percent-encoded (encodeURIComponent).
        targetPath := UrlDecode(GetQueryParam(query, "path"))
        if targetPath = ""
        {
            SendHttpResponse(hClient, 400, "Bad Request", '{"error":"Missing path parameter"}', "application/json")
            return
        }
        if !FileExist(targetPath)
        {
            SendHttpResponse(hClient, 404, "Not Found", '{"error":"Path not found"}', "application/json")
            return
        }
        try
            Run '"' targetPath '"'
        catch
        {
            SendHttpResponse(hClient, 500, "Internal Server Error", '{"error":"Failed to open path"}', "application/json")
            return
        }
        SendHttpResponse(hClient, 200, "OK", '{"ok":true}', "application/json")
    }
    else
    {
        json := '{"error":"Not found. Use GET /pick-folder or GET /open-folder?path=..."}'
        SendHttpResponse(hClient, 404, "Not Found", json, "application/json")
    }
}

; ---------- Helpers ----------

SendHttpResponse(hClient, code, statusText, body := "", contentType := "text/plain")
{
    crlf := "`r`n"
    resp := "HTTP/1.1 " code " " statusText crlf
    resp .= "Access-Control-Allow-Origin: *" crlf
    resp .= "Connection: close" crlf

    if body != ""
    {
        bodyBytes := StrPut(body, "UTF-8") - 1
        resp .= "Content-Type: " contentType "; charset=utf-8" crlf
        resp .= "Content-Length: " bodyBytes crlf
        resp .= crlf
        resp .= body
    }
    else
    {
        resp .= "Content-Length: 0" crlf
        resp .= crlf
    }

    respBytes := Buffer(StrPut(resp, "UTF-8"))
    StrPut(resp, respBytes, "UTF-8")
    DllCall("ws2_32\send", "UPtr", hClient, "Ptr", respBytes, "Int", StrPut(resp, "UTF-8") - 1, "Int", 0, "Int")
}

ShowModernFolderDialog()
{
    CLSID := Buffer(16)
    NumPut("UInt", 0xDC1C5A9C, CLSID, 0)
    NumPut("UShort", 0xE88A, CLSID, 4)
    NumPut("UShort", 0x4DDE, CLSID, 6)
    NumPut("UChar", 0xA5, CLSID, 8)
    NumPut("UChar", 0xA1, CLSID, 9)
    NumPut("UChar", 0x60, CLSID, 10)
    NumPut("UChar", 0xF8, CLSID, 11)
    NumPut("UChar", 0x2A, CLSID, 12)
    NumPut("UChar", 0x20, CLSID, 13)
    NumPut("UChar", 0xAE, CLSID, 14)
    NumPut("UChar", 0xF7, CLSID, 15)

    IID := Buffer(16)
    NumPut("UInt", 0xd57c7288, IID, 0)
    NumPut("UShort", 0xd4ad, IID, 4)
    NumPut("UShort", 0x4768, IID, 6)
    NumPut("UChar", 0xbe, IID, 8)
    NumPut("UChar", 0x02, IID, 9)
    NumPut("UChar", 0x9d, IID, 10)
    NumPut("UChar", 0x96, IID, 11)
    NumPut("UChar", 0x95, IID, 12)
    NumPut("UChar", 0x32, IID, 13)
    NumPut("UChar", 0xd9, IID, 14)
    NumPut("UChar", 0x60, IID, 15)

    hr := DllCall("ole32\CoCreateInstance", "Ptr", CLSID, "Ptr", 0, "UInt", 1, "Ptr", IID, "Ptr*", &pDialog := 0)
    if hr != 0 || !pDialog
        return DirSelect("", 0, "Please select a library folder")

    ComCall(9, pDialog, "UInt", 0x20 | 0x800 | 0x4000)
    ComCall(17, pDialog, "Str", "Please select a library folder")

    try
        ComCall(3, pDialog, "Ptr", 0)
    catch
    {
        ObjRelease(pDialog)
        return ""
    }

    pItem := 0
    ComCall(20, pDialog, "Ptr*", &pItem)

    pPath := 0
    ComCall(5, pItem, "UInt", 0x80058000, "Ptr*", &pPath)

    path := StrGet(pPath, "UTF-16")
    DllCall("ole32\CoTaskMemFree", "Ptr", pPath)
    ObjRelease(pItem)
    ObjRelease(pDialog)
    return path
}

EscapeJsonStr(str)
{
    q := Chr(34)
    str := StrReplace(str, "\", "\\")
    str := StrReplace(str, q, "\" . q)
    str := StrReplace(str, "`r", "\r")
    str := StrReplace(str, "`n", "\n")
    str := StrReplace(str, "`t", "\t")
    return str
}

GetQueryParam(query, key)
{
    for item in StrSplit(query, "&")
    {
        eqPos := InStr(item, "=")
        if !eqPos
            continue
        k := SubStr(item, 1, eqPos - 1)
        if k = key
            return SubStr(item, eqPos + 1)
    }
    return ""
}

UrlDecode(str)
{
    ; Decode a percent-encoded UTF-8 string into a Unicode string.
    ; Contract: input must be fully percent-encoded (encodeURIComponent output),
    ; so every literal character below is plain ASCII.
    if str = ""
        return ""
    str := StrReplace(str, "+", " ")
    bytes := Buffer(StrLen(str))
    idx := 0
    i := 1
    len := StrLen(str)
    while i <= len
    {
        ch := SubStr(str, i, 1)
        if ch = "%" && i + 2 <= len
        {
            NumPut("UChar", Integer("0x" SubStr(str, i + 1, 2)), bytes, idx)
            idx += 1
            i += 3
        }
        else if Ord(ch) < 128
        {
            NumPut("UChar", Ord(ch), bytes, idx)
            idx += 1
            i += 1
        }
        else
        {
            ; Unencoded non-ASCII literal — outside the contract, skip it.
            i += 1
        }
    }
    return StrGet(bytes, idx, "UTF-8")
}

AddrInet(buffer, ip, port)
{
    ; sin_family = AF_INET = 2
    NumPut("UShort", 2, buffer, 0)
    ; sin_port (network byte order)
    NumPut("UShort", DllCall("ws2_32\htons", "UShort", port, "UShort"), buffer, 2)
    ; sin_addr (127.0.0.1 = 0x0100007F network byte order)
    parts := StrSplit(ip, ".")
    if parts.Length = 4
    {
        addrNum := parts[1] | (parts[2] << 8) | (parts[3] << 16) | (parts[4] << 24)
        NumPut("UInt", addrNum, buffer, 4)
    }
    ; sin_zero
    NumPut("Int64", 0, buffer, 8)
}

ConsoleWrite(msg)
{
    try FileAppend(msg "`n", "*")
}

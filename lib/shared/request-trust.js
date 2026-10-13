function header(headers, name) {
    const value = headers[name];
    return typeof value === 'string' ? value : undefined;
}
/** 解析 Host 头的权威（authority）；不可解析返回 undefined。 */
function parseAuthority(authority) {
    try {
        return new URL(`http://${authority}`);
    }
    catch {
        return undefined;
    }
}
/** hostname 是否为本地回环。 */
export function isLoopbackHostname(hostname) {
    if (hostname === 'localhost' || hostname === '[::1]')
        return true;
    const parts = hostname.split('.');
    return parts.length === 4
        && parts[0] === '127'
        && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** 请求权威是否匹配 trustedHosts 中的一条（无端口条目匹配该主机任意端口）。 */
function isTrustedAuthority(hostUrl, trustedHosts) {
    return trustedHosts.some((entry) => {
        const entryUrl = parseAuthority(entry);
        if (entryUrl === undefined)
            return false;
        return entryUrl.port === '' || entryUrl.port === '80' || entryUrl.port === '443'
            ? entryUrl.hostname === hostUrl.hostname
            : entryUrl.host === hostUrl.host;
    });
}
/** 是否放行一条到达自动化 API / WebSocket 桥的请求。 */
export function isTrustedApiRequest(request, trustedHosts) {
    const host = header(request.headers, 'host');
    if (host === undefined)
        return false;
    const hostUrl = parseAuthority(host);
    if (hostUrl === undefined)
        return false;
    if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts))
        return false;
    if (header(request.headers, 'sec-fetch-site') === 'cross-site')
        return false;
    const origin = header(request.headers, 'origin');
    if (origin === undefined)
        return true;
    if (origin === 'dsh-app://app')
        return !!request.socket?.remoteAddress && isLoopbackHostname(request.socket.remoteAddress.replace(/^::ffff:/, ''));
    try {
        return new URL(origin).hostname === hostUrl.hostname;
    }
    catch {
        return false;
    }
}

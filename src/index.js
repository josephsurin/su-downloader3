import { getRemoteFilesize, getMetadata, makeRequests, getThreadPositions, getDownloadProgressInfo } from './core'

const defaultOptions = {
	threads: 4,
	timeout: 3 * 60 * 1000,
	headers: null,
	throttleRate: 500
}

function startDownload(url, savePath, options = defaultOptions) {

	var filesize$ = getRemoteFilesize(url)

	var meta$ = getMetadata(url, savePath, options.threads, filesize$)

	var requestsAndMeta$ = makeRequests(meta$, options)

	var threadPositions$ = getThreadPositions(requestsAndMeta$)

	var downloadProgressInfo$ = getDownloadProgressInfo(threadPositions$, options.throttleRate)

	//the first value emitted is the meta data object
	return downloadProgressInfo$
}

module.exports = {
	startDownload
}
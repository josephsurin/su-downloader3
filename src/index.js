import { getRemoteFilesize, getMetadata, makeRequests } from './core'

function startDownload(url, savePath, options = { threads: 4, headers: null }) {

	var filesize$ = getRemoteFilesize(url)

	var meta$ = getMetadata(url, savePath, options.threads, filesize$)

	var request$s = makeRequests(meta$, options.headers)

	return request$s
}

module.exports = {
	startDownload
}
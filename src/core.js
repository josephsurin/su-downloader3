const fs = require('graceful-fs')
const request = require('request')
import { bindNodeCallback, from, of, throwError, empty } from 'rxjs'
import { map, tap, filter, scan, finalize, mergeAll, concatMap, mergeMap } from 'rxjs/operators'
import { sudPath, calculateRanges, getRangeHeaders, createRequest, partialPath, getLocalFilesize, rebuildFiles  } from './util'

//the observable created from the requestHead function will emit the array [response, ''] if no error is caught
//because the parameters for the request callback are (err, response, body) and body is empty
//see https://rxjs.dev/api/index/function/bindNodeCallback for more info
const requestHead = bindNodeCallback(request.head)

export function getRemoteFilesize(url) {
	return requestHead(url).pipe(
		mergeMap(x => {
			var response = x[0]
			var { statusCode } = response
			if(statusCode >= 400 && statusCode <= 512) {
				return throwError(response)
			} else {
				return of(response.headers['content-length'])
			}
		})
	)
}

export function getMetadata(url, savePath, threads, filesize$) {
	return filesize$.pipe(
		map(filesize => {

			var ranges = calculateRanges(filesize, threads)

			var meta = {
				url,
				savePath,
				sudPath: sudPath(savePath),
				filesize,
				ranges
			}

			return meta
		}),

		//write data to .sud meta file side effect
		tap(meta => {
			fs.writeFile(meta.sudPath, JSON.stringify(meta))
		})
	)
}

//calculate ranges based on existing .PARTIAL files
//and transform the meta object into an object holding an array of request observables
//and the meta data object
export function makeRequests(meta$, options) {
	return meta$.pipe(
		map(meta => {

			var { url, savePath, ranges } = meta
			var rangeHeaders = getRangeHeaders(savePath, ranges)
			var request$s = new Array(rangeHeaders.length)

			rangeHeaders.forEach((rangeHeader, index) => {
				if(rangeHeader) {
					var headers = Object.assign(options.headers || {}, { range: rangeHeader })
					var requestOptions = { headers, timeout: options.timeout }
					request$s[index] = createRequest(url, requestOptions)
				} else {
					request$s[index] = empty()
				}
			})

			return { request$s, meta }
		})
	)
}

//write to buffer side effect within and rebuild upon completion
//a separate meta$ observable created from the passed meta object is concatenated to the front
//the first item emitted from the returned variable will be the meta object
export function getThreadPositions(requestsAndMeta$) {
	return requestsAndMeta$.pipe(
		concatMap(requestsAndMeta => {

			var { request$s, meta, meta: { savePath, ranges } } = requestsAndMeta

			var transformedRequest$s = request$s.map((request$, index) => {

				var partialFile = partialPath(savePath, index)
				var startPos = ranges[index][0] + getLocalFilesize(partialFile)
				var writeStream = fs.createWriteStream(partialFile, { flags: 'a', start: startPos })

				return request$.pipe(
					filter(x => x),
					tap(data => writeStream.write(data)),
					scan((position, data) => position += Buffer.byteLength(data), startPos),
					finalize(() => writeStream.end())
				)
			})

			//setup mergedTransformedRequests$ to rebuild on completion of ALL inner observables
			//merge flattens the higher-order observable into a single observable
			var mergedTransformedRequests$ = from(transformedRequest$s).pipe(
				mergeAll(),
				finalize(() => rebuildFiles(savePath, ranges.length))
			)

			var meta$ = of(meta)

			return of(meta$, mergedTransformedRequests$)
		}),

		//merge the meta observable and the already flattened position observables into one observable
		mergeAll()
	)
}
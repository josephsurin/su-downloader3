const fs = require('graceful-fs')
const path = require('path')
const Url = require('url')
const request = require('request')
import { bindNodeCallback, from, of, throwError, empty, bindCallback, Observable } from 'rxjs'
import { map, tap, filter, scan, finalize, mergeAll, concatMap, mergeMap, pluck, throttleTime, concat } from 'rxjs/operators'
import { sudPath, calculateRanges, getRangeHeaders, fsReadFile, createRequest, partialPath, getLocalFilesize, rebuildFiles, getInitialDownloadProgressInfo, calculateDownloadProgressInfo  } from './util'

//the observable created from the requestHead function will emit the array [response, ''] if no error is caught
//because the parameters for the request callback are (err, response, body) and body is empty
//see https://rxjs.dev/api/index/function/bindNodeCallback for more info
const requestHead = bindNodeCallback(request.head)

export function getMetadata(url, threads, savePath, saveDir) {
	return requestHead(url).pipe(
		mergeMap(x => {
			var response = x[0]
			var { statusCode } = response
			if(statusCode >= 400 && statusCode <= 512) {
				return throwError(response)
			} else {
				return of(parseInt(response.headers['content-length']))
			}
		}),
		map(filesize => {

			var ranges = calculateRanges(filesize, threads)

			savePath = savePath || path.join(saveDir || process.cwd(), path.basename(Url.parse(url).path))
			
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

export function readMetadata(sudPath) {
	return fsReadFile(sudPath).pipe(
		map(rawMeta => JSON.parse(rawMeta))
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

//write to buffer within and rebuild upon completion
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
				var writeToStream = bindCallback(writeStream.write).bind(writeStream)
				return request$.pipe(
					filter(x => x),
					//the nested concatMap ensures the buffer is written and that this writing completes
					//before the thread position is updated
					//this is necessary to ensure the .PARTIAL files rebuild correctly
					//we need it to be nested as the values emitted by writeToStream are not useful
					concatMap(data => 
						of(data).pipe(
							concatMap(data => writeToStream(data)),
							map(() => Buffer.byteLength(data))
						)
					),
					scan((threadPosition, chunkSize) => threadPosition + chunkSize, startPos),
					finalize(() => writeStream.end())
				)
			})

			//setup mergedTransformedRequests$ to rebuild on completion of ALL inner observables
			//merge flattens the higher-order observable into a single observable
			var mergedTransformedRequests$ = from(transformedRequest$s).pipe(
				mergeAll(),
				//once the source observable finishes, rebuild the files
				concat(rebuildFiles(meta))
			)

			var meta$ = of(meta)

			return of(meta$, mergedTransformedRequests$)
		}),

		//merge the meta observable and the already flattened position observables into one observable
		mergeAll()
	)
}

//use the meta data object (first item to be emitted) and the thread positions
//to calculate various information about the download progress
export function getDownloadProgressInfo(threadPositions$, throttleRate) {
	return threadPositions$.pipe(
		throttleTime(throttleRate),
		scan((acc, threadPosition) => {
			//initialise the accumulator to hold the meta data object and initial download progress info
			if(acc == 0) {
				var meta = threadPosition
				var initialDownloadProgressInfo = getInitialDownloadProgressInfo(meta)
				//the downloadProgressInfo field is also set to the meta data object so that
				//the meta data object is available (as the first item emitted) once plucked
				acc = { meta, initialDownloadProgressInfo, downloadProgressInfo: meta }
			} else {
				//threadPosition is an actual thread position and not the meta data object, calculate the download progress info
				var downloadProgressInfo = calculateDownloadProgressInfo(acc, threadPosition)
				//set initialDownloadProgressInfo to null so the next iteration of calculateDownloadProgressInfo
				//knows to use the accumulator's downloadProgressInfo instead
				acc = Object.assign(acc, { initialDownloadProgressInfo: null, downloadProgressInfo })
			}

			return acc
		}, 0),
		pluck('downloadProgressInfo')
	)
}
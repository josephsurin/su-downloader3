const fs = require('graceful-fs')
const path = require('path')
const { startDownload, sudPath } = require(path.join(__dirname, '../build/downloader'))
const { skip, pairwise, every, map, concat, delay } = require('rxjs/operators')
const { of } = require('rxjs')

const testObserver = id => {
	return {
		next: console.log,
		error: e => console.log('caught error', e),
		complete: () => console.log(id, 'completed')
	}
}

const url = 'http://ftp.iinet.net.au/pub/test/1meg.test'
const savePath = `./test/downloads/big/1meg.test`
const locations = { url, savePath }
const options = {
	threads: 2,
	throttleRate: 100
}

if(!fs.existsSync('./test/downloads/big/')) fs.mkdirSync('./test/downloads/big/')

test('simple download and progress info test (monotonically increasing download percentage)', done => {
	var download$ = startDownload(locations, options).pipe(
		skip(1),
		map(x => x.total.percentage),
		skip(1),
		pairwise(),
		every(x => x[1] > x[0])
	)

	download$.subscribe(x => {
		expect(fs.existsSync(savePath)).toBe(true)
		expect(fs.existsSync(sudPath(savePath))).toBe(false)
		done()
	})
}, 2 * 60 * 1000)
//it shouldn't take more than 2 minutes to download 5MB


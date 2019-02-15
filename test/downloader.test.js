const fs = require('graceful-fs')
const { startDownload, sudPath } = require('../build/downloader')
const { skip, pairwise, every, map, concat, delay } = require('rxjs/operators')
const { of } = require('rxjs')

const testObserver = id => {
	return {
		next: console.log,
		error: e => console.log('caught error', e),
		complete: () => console.log(id, 'completed')
	}
}

const url = 'http://ftp.iinet.net.au/pub/test/5meg.test1'
const savePath = `./test/downloads/big/5meg.test1`
const locations = { url, savePath }
const options = {
	threads: 2,
	throttleRate: 100
}

test('simple download and progress info test (monotonically increasing download percentage)', done => {
	var download$ = startDownload(locations, options).pipe(
		skip(1),
		map(x => x.total.percentage),
		skip(1),
		pairwise(),
		every(x => x[1] > x[0]),
		delay(1000), //allow 1 second to rebuild
		concat(of('finished'))
	)

	download$.subscribe(x => {
		if(x == 'finished') {
			expect(fs.existsSync(savePath)).toBe(true)
			expect(fs.existsSync(sudPath(savePath))).toBe(false)
			done()
		} else {
			expect(x).toBe(true)
		}
	})
}, 2 * 60 * 1000)
//it shouldn't take more than 2 minutes to download 5MB


//NOTE: When running examples, you must exit the process manually as the draftlog module prevents
//the process from exiting because it is constantly reading the stdin stream

const path = require('path')
const bytes = require('bytes')
require('draftlog').into(console).addLineListener(process.stdin)

const testObserver = draft => {
	var sp = ''
	return {
		next: x => {
			if(x.savePath) {
				sp = path.basename(x.savePath)
			} else {
				draft(`${sp}  |  Downloaded: ${bytes(x.total.downloaded)}/${bytes(x.total.filesize)}   |   Speed: ${bytes(x.speed)}/s   |   Avg Speed: ${bytes(x.avgSpeed)}/s   |   Elapsed: ${x.time.elapsed / 1000}s   |   ETA: ${x.time.eta.toFixed(2)}s \n ${percentageToBar(x.total.percentage)}   ${x.total.percentage.toFixed(2)}%`)
			}
		},
		error: console.log,
		complete: () => draft('FINISHED DOWNLOADING ', sp)
	}
}

module.exports = testObserver

const percentageToBar = percentage => {
	var fullLength = 50
	var progressLength = Math.floor(fullLength * percentage / 100)
	var bar = Array(fullLength).fill(' ')
	bar = bar.fill('▬', 0, progressLength)
	return bar
}
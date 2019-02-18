import { startDownload, killFiles, sudPath } from '../downloader/'

const SuDScheduler = class {

	//holds all download tasks as objects with status and params fields
	#taskQueue = []
	//holds objects that have a key and a subscription field
	//the subscription field holds the flowing download subscription
	#downloadSubscriptions = {}

	options = {}

	//set maxConcurrentDownloads to 0 for unlimited concurrent downloads
	constructor({ autoStart = true, maxConcurrentDownloads = 4, downloadOptions = {} } = {}) {
		this.options.autoStart = autoStart
		this.options.maxConcurrentDownloads = maxConcurrentDownloads
		this.options.downloadOptions = downloadOptions
	}

	//PUBLIC METHODS

	//returns the task queue
	get taskQueue() {
		return this.#taskQueue
	}

	get queuedCount() {
		return this.#countTasks('queued')
	}

	get activeCount() {
		return this.#countTasks('active')
	}
	
	get stoppedCount() {
		return this.#countTasks('stopped')
	}

	get taskCount() {
		return this.#countTasks()
	}

	//adds a download task to the queue
	//an observer object MUST be provided as the 3rd or 4th positional argument
	//this method is used to add new downloads or resume from pre existing .sud files
	//if the intention is to queue a download from a pre existing .sud file, locations should be
	//the .sud file path and options.threads will be unnecessary
	//key should be unique
	queueDownload(key, locations, options, userObserver) {
		if(!this.#keyIsUnique(key)) throw('KEYS MUST BE UNIQUE')

		//if options is omitted, assume it is the observer
		if(options.next) var userObserver = options

		var taskQueueItem = {
			key,
			status: 'queued',
			params: { locations, options: options.next ? {} : options },
			userObserver
		}
		this.#taskQueue.push(taskQueueItem)
		
		this.#tryNextInQueue()
		
		if(!this.options.autoStart) {
			//convenience object to allow the user to dot chain start()
			return {
				start: () => this.startDownload(key)
			}
		}

		return true
	}

	//starts a download task, or resumes an active download
	//starting a new download task using this methods will ignore
	//the max concurrent download limit
	startDownload(key) {
		var taskQueueItem = this.#getTaskQueueItem(key)
		var { userObserver, params: { locations, options } } = taskQueueItem
		
		taskQueueItem.status = 'active'

		var wrappedObserver = this.#wrapInternalObserver(key, userObserver)
		var dlOptions = Object.assign(this.options.downloadOptions, options)
		var dlSubscription = startDownload(locations, dlOptions).subscribe(wrappedObserver)
		this.#downloadSubscriptions[key] = dlSubscription

		return true
	}

	//pauses an active download and stops if the second parameter is true
	//an active download that is paused is still considered active
	//stopping a download task allows for more tasks to be auto started
	//as a stopped task is not considered active
	//returns false if the download task is already paused/stopped or has not yet started
	pauseDownload(key, stop = false) {
		var taskQueueItem = this.#getTaskQueueItem(key)
		var dlSubscription = this.#downloadSubscriptions[key]
		
		taskQueueItem.status = stop ? 'stopped' : taskQueueItem.status
		
		if(!dlSubscription) return false

		dlSubscription.unsubscribe()
		delete this.#downloadSubscriptions[key]

		this.#tryNextInQueue()
	}

	//stops an active download and removes associated .sud and .PARTIAL files, or
	//removes queued download task from queue
	killDownload(key) {
		var taskQueueItem = this.#getTaskQueueItem(key)
		var { status } = taskQueueItem
		
		var dlSubscription = this.#downloadSubscriptions[key]
		
		if(dlSubscription) {
			this.#downloadSubscriptions[key].unsubscribe()
			delete this.#downloadSubscriptions[key]
		}

		this.#removeTaskQueueItem(key)
		killFiles(key)

		this.#tryNextInQueue()
	}

	//starts downloading as many as possible, limited by the maxConcurrentDownloads option
	startQueue() {
		this.#taskQueue.forEach(taskQueueItem => {
			if(taskQueueItem.status == 'stopped') {
				taskQueueItem.status = 'queued'
			}
		})

		var activeCount = this.#countStatus('active')
		var { maxConcurrentDownloads } = this.options
		while(activeCount < maxConcurrentDownloads && this.#taskQueue[activeCount + 1]) {
			var { key, status } = this.#taskQueue[activeCount]
			if(status == 'active') return
			this.startDownload(key)
			activeCount++
		}
	}

	//pauses/stops all active downloads
	pauseAll(stop = false) {
		this.#taskQueue.forEach(taskQueueItem => this.pauseDownload(taskQueueItem.key, stop))
	}

	//PRIVATE METHODS
	#countStatus(status) {
		return this.#taskQueue.filter(taskQueueItem => taskQueueItem.status == status).length
	}

	#countTasks() {
		return this.#taskQueue.length
	}

	#keyIsUnique(key) {
		return this.#getTaskQueueItem(key) == undefined
	}

	//checks if the conditions for starting a new task are met
	#canStartNext() {
		var { maxConcurrentDownloads } = this.options
		var nextExists = this.#taskQueue.findIndex(taskQueueItem => taskQueueItem.status == 'queued') != -1
		return (maxConcurrentDownloads == 0 || this.#countStatus('active') < maxConcurrentDownloads) && nextExists
	}

	//starts the next task in queue
	#startNextInQueue() {
		var { key } = this.#taskQueue.find(taskQueueItem => taskQueueItem.status == 'queued')
		this.startDownload(key)
	}

	//checks for start new condition and starts next if met
	#tryNextInQueue() {
		if(this.options.autoStart && this.#canStartNext()) {
			this.#startNextInQueue()
		}
	}

	#getTaskQueueItem(key) {
		return this.#taskQueue.find(taskQueueItem => taskQueueItem.key == key)
	}

	#removeTaskQueueItem(key) {
		var index = this.#taskQueue.findIndex(taskQueueItem => taskQueueItem.key == key)
		this.#taskQueue.splice(index, 1)
	}

	//the real observer used with the observable returned by the downloader's startDownload function
	//this observer calls the functions of the user defined observer, but also facilitates
	//necessary maintenance tasks such as updating the download task's status and cleaning up
	#wrapInternalObserver(key, userObservable) {
		var taskQueueItem = this.#getTaskQueueItem(key)
		var { status } = taskQueueItem
		return {
			next: userObservable.next,
			error: userObservable.error,
			complete: () => {
				userObservable.complete()

				//remove the useless dead subscription and internal reference
				this.#removeTaskQueueItem(key)
				delete this.#downloadSubscriptions[key]

				this.#tryNextInQueue()
			}
		}
	}
	
}

module.exports = SuDScheduler

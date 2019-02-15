import { startDownload, sudPath } from '../downloader/'

const SuDScheduler = class {

	//holds all download tasks as objects with status and params fields
	#taskQueue = []
	//holds objects that have a key and a subscription field
	//the subscription field holds the flowing download subscription
	#downloadSubscriptions = {}

	options = {}

	//if autoStart is false, maxConcurrentDownloads is useless
	//set maxConcurrentDownloads to 0 for unlimited concurrent downloads
	constructor({ autoStart = true, maxConcurrentDownloads = 4, downloadOptions = {} } = {}) {
		this.options.autoStart = autoStart
		this.options.maxConcurrentDownloads = maxConcurrentDownloads
		this.options.downloadOptions = downloadOptions
	}

	//PUBLIC METHODS

	//adds a download task to the queue
	//if autoStart option is enabled, userObserver MUST be provided
	//this method is used to add new downloads or resume from pre existing .sud files
	//if the intention is to queue a download from a pre existing .sud file, locations should be
	//the .sud file path and options.threads will be unnecessary
	queueDownload(locations, options, userObserver) {
		//if options is omitted, assume it is the observer
		if(options.next) var userObserver = options

		var taskQueueItem = {
			key: typeof locations == 'string' ? locations : sudPath(locations.savePath),
			status: 'queued',
			params: { locations, options },
			userObserver
		}
		this.#taskQueue.push(taskQueueItem)
		
		if(this.options.autoStart && this.#canStartNew()) {
			this.#startNextInQueue()
		} else {
			//convenience object to allow the user to dot chain start()
			return {
				start: () => this.startDownload(taskQueueItem.key, userObserver)
			}
		}
		
	}

	//starts a download task, or resumes an active download
	//starting a new download task using this methods will ignore
	//the max concurrent download limit
	startDownload(key, observer) {
		var taskQueueItem = this.#getTaskQueueItem(key)
		var { userObserver, params: { locations, options } } = taskQueueItem
		
		taskQueueItem.status = 'active'
		
		//reuse the original user observer if it is defined
		if(userObserver.next) observer = userObserver
		var wrappedObserver = this.#wrapInternalObserver(key, observer)
		var dlOptions = Object.assign(this.options.downloadOptions, options)
		var dlSubscription = startDownload(locations, dlOptions).subscribe(wrappedObserver)
		this.#downloadSubscriptions[key] = dlSubscription

		return true
	}

	//pauses an active download and stops if the second parameter is true
	//an active download that is paused is still considered active
	//stopping a download task allows for more tasks to be auto started
	//a stopped task is not considered active
	//returns false if the download task is already paused or does not exist
	pauseDownload(key, stop = false) {
		var taskQueueItem = this.#getTaskQueueItem(key)
		var dlSubscription = this.#downloadSubscriptions[key]
		if(!taskQueueItem || !dlSubscription) return false

		//temporary status to inform the internal observable complete function
		taskQueueItem.status = stop ? 'stopping' : 'pausing'

		dlSubscription.unsubscribe()
	}

	//stops an active download and removes associated .sud and .PARTIAL files, or
	//removes download task from queue 
	killDownload(key) {

	}

	//starts downloading as many as possible, limited by the maxConcurrentDownloads option
	startQueue() {

	}

	//stops all active (including forced) downloads
	stopQueue() {

	}

	//PRIVATE METHODS
	#countStatus(status) {
		return this.#taskQueue.filter(taskQueueItem => taskQueueItem.status == status).length
	}

	#countTasks() {
		return this.#taskQueue.length
	}

	//checks if the conditions for starting a new task are met
	#canStartNew() {
		var { maxConcurrentDownloads } = this.options
		var nextExists = this.#taskQueue.findIndex(taskQueueItem => taskQueueItem.status == 'queued') != -1
		return (maxConcurrentDownloads == 0 || this.#countStatus('active') < maxConcurrentDownloads) && nextExists
	}

	//starts the next task in queue
	#startNextInQueue() {
		var { key, userObserver } = this.#taskQueue.find(taskQueueItem => taskQueueItem.status == 'queued')
		this.startDownload(key, userObserver)
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

				//change status if pausing or stopping
				switch(status) {
					//if status is active, this function is being called because the download has finished
					case 'active': this.#removeTaskQueueItem(key); break
					case 'pausing': taskQueueItem.status = 'active'; break
					case 'stopping': taskQueueItem.status = 'stopped'
				}

				//remove the useless dead subscription
				delete this.#downloadSubscriptions[key]

				//try and start next download
				if(this.options.autoStart && this.#canStartNew()) {
					this.#startNextInQueue()
				}
			}
		}
	}
	
}

module.exports = SuDScheduler
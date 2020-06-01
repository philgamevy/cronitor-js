# Cronitor Ping and Monitor API Client

[![Build Status](https://travis-ci.org/cronitorio/cronitor-js.svg?branch=master)](https://travis-ci.org/cronitorio/cronitor-js)

Cronitor is a service for heartbeat-style monitoring of anything that can send an HTTP request. It's particularly well suited for monitoring cron jobs, node-cron, or any other background task.

This library provides a simple abstraction for performing monitor CRUD operations as well as light weight interface for integrating cronitor into your Javascript project. For a better understanding of the APIs this library talks to please see our [Ping API docs](https://cronitor.io/docs/ping-api) and [Monitor API docs](https://cronitor.io/docs/monitor-api). For a general introduction to Cronitor please read [How Cronitor Works](https://cronitor.io/docs/how-cronitor-works).

## Installation

`npm install cronitor`

## Usage

### Ping a Monitor
```javascript
const { Ping } = require('cronitor')

// create new object with monitor's unique code
ping = new Ping({code: 'd3x0c1'})

// api matches cronitor's
ping.run()
ping.complete()
ping.fail("Hard Fail") // all methods accept an optional message

// if authenticated pings are enabled add your apiKey like so
const ping = new Ping({code: 'd3x0c1', apiKey: 'xxxxxx'})
ping.run("My auth key is used to authenticate requests")
```

### Creating a Monitor

```javascript
var { Monitor } = require('../index')

// instantiate with a apiKey (https://cronitor.io/settings#account)
const monitor = new Monitor({apiKey: 'xxxxxx'})

// sugar syntax for creating a new cron monitor
monitor.createCron({
    name: 'Nightly DB Backup',
    expression: '0 0 * * *',
    notificationLists: ['devops-pagerduty'] // optional. account default will be used if omitted.
})

// sugar syntax for creating a new heartbeat monitor (and immediately pinging it)
monitor.createHeartbeat({
    name: 'Queue Worker Heartbeat',
    every: [60, 'seconds']
}).then((obj) => {
    // all CRUD methods return a Promise object.
    // resolve method is passed a POJO representing the obj
    console.log(obj.code) // d3x0c1
})


// create any type of monitor.
// pass an object that adheres to the Monitor v3 API specification (https://cronitor.io/docs/monitor-api)
// this is equivalent to the first example above
monitor.create({
    type: 'cron'
    name: 'Nightly DB Backup',
    rules: [
        {
            rule_type: 'not_on_schedule',
            value: '0 0 * * *',
        }
    ],
    notifications: {
        templates: ['devops-pagerduty']
    }
}).then((obj) => {
    console.log(obj.name) // 'Nightly DB Backup'
})

```

### Additional methods

```javascript

var { Monitor } = require('cronitor')
const monitor = new Monitor({apiKey: 'xxxxxx', code: 'd3x0c1'})

// Update existing attributes on a monitor
monitor.update({name: 'Midnight UTC DB Backup'}).then((monitor) => {
    console.log(monitor.name) // 'Midnight UTC DB Backup'
})

monitor.pause(5)
monitor.unpause()

// delete a monitor
monitor.delete()

// does not require a code
monitor.filter({page: 2}).then((res) => {
    console.log(res.total_monitor_count) // 83
    console.log(res.page) // 2
    console.log(res.monitors.length) // 33
})

```


## Contributing

By participating in this project you agree to abide by the [Code of Conduct](http://contributor-covenant.org/version/1/3/0/)

Pull requests and features are happily considered.  Pull Requests are preferred to Issues, but if you have any questions, please do ask before you get too far.

## To contribute

Fork, then clone the repo:

    git clone git@github.com:your-username/cronitor.git

Set up your machine:

    npm install

Make sure the tests pass:

    npm test

Make your change. Add tests for your change. Make the tests pass:

    npm test


Push to your fork and [submit a pull request]( https://github.com/cronitorio/cronitor-js/compare/)


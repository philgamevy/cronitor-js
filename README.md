# Cronitor Ping and Monitor API Client

[![Build Status](https://travis-ci.org/cronitorio/cronitor-js.svg?branch=master)](https://travis-ci.org/cronitorio/cronitor-js) [![codecov](https://codecov.io/gh/cronitorio/cronitor-js/branch/2.0.0/graph/badge.svg)](https://codecov.io/gh/cronitorio/cronitor-js)

Cronitor provides continuous monitoring for cron jobs, daemons, data pipelines, queue workers, and anything else that anything that can send or receive an HTTP request.

If you are unfamiliar with Cronitor, our [Cron Monitoring Guide](https://cronitor.io/docs/cron-job-monitoring), [Heartbeat Monitoring Guide](https://cronitor.io/docs/heartbeat-monitoring) and [Ping API Reference](https://cronitor.io/docs/ping-api) are a great place to start.

Cronitor-JS provides three separate modules:
- [Ping](#ping) - Standard integration with Cronitor.
- [Heartbeat](#heartbeat) - A background integration for daemons or long running jobs.
- [Monitor](#monitor) - Retrieve monitor information, create/modify monitors, pause alerting for a monitor.

## Installation
`npm install cronitor`

## <a name="ping"></a>Ping
A Ping object allows you to flexibly integrate Cronitor into your task system. The example below uses [NodeCron](https://github.com/node-cron/node-cron) to demonstrate how to use Ping

```javascript
const Cron = require('node-cron');
const { Ping } = require('cronitor')
const WelcomeEmail = require('./welcome-email')

// a job running every 5 minutes
Cron.schedule('*/5 * * * *', () => {
    ping = new Ping('d3x0c1') // create new object with monitor's unique id/code
    ping.run() // the job has started
    WelcomeEmail.send()
    ping.complete() // the job finished successfully
});


// API matches Ping API https://cronitor.io/docs/ping-api
ping.run() // the job has started running
ping.complete() // the job has completed successfully
ping.fail() // the job has failed
ping.ok() // reset a failing job to a passing state.
```

### Options

```javascript
// if authenticated pings are enabled, add your apiKey when creating a Ping object
const ping = new Ping({monitorId: 'd3x0c1', apiKey: 'xxxxxx'})

// optional params can be passed as an object the following params are allowed
ping.complete({
    env: '', // the environment this is running in (development, staging, production)
    host: '' // the hostname of machine running this command
    message: '', // optional message that will be displayed in alerts and on your dashboard.
    duration: '' // override cronitor's duration calculation with your own recorded value. ignored on non `complete` calls
})
```
## <a name="heartbeat">Heartbeat
A Heartbeat object is a special integration for daemons, control loops, or other long running processes. It provides a single `tick` method that is used to indicate that a process is still running. The interval at which the `tick` counts are flushed to Cronitor is configurable (default 60 seconds).

```javascript
// if authenticated pings are enabled, add your apiKey when creating a Ping object
const heartbeat = new Heartbeart({monitorId: 'd3x0c1',

// optional params can be passed as an object the following params are allowed
ping.complete({
    env: '', // the environment this is running in (development, staging, production)
    host: '' // the hostname of machine running this command
    message: '', // optional message that will be displayed in alerts and on your dashboard.
    duration: '' // override cronitor's duration calculation with your own recorded value. ignored on non `complete` calls
})
```

## <a name="monitor"></a>Monitor

The Monitor object provides a wrapper around our [Monitor API](https:/cronitor.io/docs/monitor-api). Use this object to:
    - Retrieve status/configuration information about a monitor/set of monitors.
    - Modify or delete an existing monitor.
    - Pause/unpause alerting of an existing monitor.


### Create a Monitor

```javascript
const { Monitor } = require('../index')

// get your apiKey at https://cronitor.io/settings#account
const monitor = new Monitor({apiKey: 'xxxxxx'})

// sugar syntax for creating a new cron monitor
monitor.createCron({
    name: 'Nightly DB Backup',
    expression: '0 0 * * *',
    notificationLists: ['devops-pagerduty'] // optional. account default will be used if omitted.
}).then((resp) => {
    console.log(resp.name) // 'Nightly DB Backup',
}

// sugar syntax for creating a new heartbeat monitor
monitor.createHeartbeat({
    name: 'Queue Worker Heartbeat',
    every: [60, 'seconds'] // accepts 'seconds', 'minutes', 'hours', 'days'
})

// create any type of monitor. this is equivalent to the first example above.
// pass an object that adheres to the Monitor API specification (https://cronitor.io/docs/monitor-api).
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
})

```

### Retrieve Monitor(s)

```javascript
const { Monitor } = require('cronitor')
const monitor = new Monitor({apiKey: 'xxxxxx'})
monitor.get('d3x01').then((resp) => {
    console.log(resp.name) // 'Midnight UTC DB Backup'
})

// retrieve a page of monitors (50 monitors per page)
monitor.filter({page: 2}).then((resp) => {
    console.log(resp.total_monitor_count) // 83
    console.log(resp.page) // 2
    console.log(resp.monitors.length) // 33
})
```

### Pause Alerting
```javascript
const { Monitor } = require('cronitor')
const monitor = new Monitor({apiKey: 'xxxxxx'})
monitor.pause('d3x0c1', 5) // paused for 5 hours
monitor.unpause('d3x0c1')
```

### Update or Delete
```javascript
const { Monitor } = require('cronitor')
const monitor = new Monitor({apiKey: 'xxxxxx'})

// Update existing attributes on a monitor
monitor.update('d3x0c1', {name: 'Midnight UTC DB Backup'}).then((resp) => {
    console.log(resp.name) // 'Midnight UTC DB Backup'
})

monitor.pause('d3x0c1', 5)
monitor.unpause('d3x0c1')

// delete a monitor
monitor.delete('d3x0c1')

// does not require a code
monitor.filter({page: 2}).then((resp) => {
    console.log(resp.total_monitor_count) // 83
    console.log(resp.page) // 2
    console.log(resp.monitors.length) // 33
})
```


## Contributing

Pull requests and features are happily considered! By participating in this project you agree to abide by the [Code of Conduct](http://contributor-covenant.org/version/1/3/0/).

### To contribute

Fork, then clone the repo:

    git clone git@github.com:your-username/cronitor.git

Set up your machine:

    npm install

Make sure the tests pass:

    npm test

Make your change. Add tests for your change. Make the tests pass:

    npm test


Push to your fork and [submit a pull request]( https://github.com/cronitorio/cronitor-js/compare/)


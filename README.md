# Effects as Data

Express async workflows using pure functions.

## Installation
```sh
npm i --save effects-as-data
```

### Try It
You can run the code below using this command.  You can see the code [here](https://github.com/orourkedd/effects-as-data/tree/master/src/demo-cli).
```sh
npm install
npm run demo
```

## Usage
### Action Creators
First, create some action creators.  You can find these in [`demo-cli/actions`](https://github.com/orourkedd/effects-as-data/blob/master/src/demo-cli/actions/index.js):

```js
const httpGet = (url) => {
  return {
    type: 'httpGet',
    url
  }
}

const log = (message) => {
  return {
    type: 'log',
    message
  }
}

const writeFile = (path, data) => {
  return {
    type: 'writeFile',
    path,
    data
  }
}

const userInput = (question) => {
  return {
    type: 'userInput',
    question
  }
}
```

### Action Handlers
Second, create handlers for the actions.  This is the only place where side-effect producing code should exist.  You can find these in [`demo-cli/handlers`](https://github.com/orourkedd/effects-as-data/tree/master/src/demo-cli/handlers):
```js
const httpGetActionHandler = (action) => {
  return get(action.url)
}

const writeFileActionHandler = (action) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(action.path, action.data, {encoding: 'utf8'}, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve({
          realpath: path.resolve(action.path),
          path: action.path
        })
      }
    })
  })
}

const logHandler = (action) => {
  console.log(action.message)
}

const userInputHandler = (action) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question(action.question, (answer) => {
      resolve(answer)
      rl.close()
    })
  })
}
```

### Pure Functions for Business Logic
Third, define a pure function that `effects-as-data` can use to perform your business logic.  This function coordinates your workflow.  The function below does a lot and would normally be difficult to test:
* Reads user input (a Github username).
* Does a GET request to Github for the user's repositories.
* Prints the user's repositories in a formatted list.
* Writes the user's repositories to a file.

You can find this in [`demo-cli/functions/save-repositories.js`](https://github.com/orourkedd/effects-as-data/blob/master/src/demo-cli/functions/save-repositories.js)

```js
const { userInput, httpGet, writeFile, log } = require('../actions')
const { isFailure } = require('../../util')
const { buildList, printRepository } = require('./helpers')

const saveRepositories = function * (filename) {
  //  Get the user's Github username from the command line
  const {payload: username} = yield userInput('\nEnter a github username: ')

  //  Get the users repositories based on the username
  const repos = yield httpGet(`https://api.github.com/users/${username}/repos`)
  if (isFailure(repos)) return repos

  //  Format the list and print it to the console
  const list = buildList(repos.payload)
  yield printRepository(list, username)

  //  Write the repositories as JSON to disk
  const writeResult = yield writeFile(filename, JSON.stringify(repos.payload))
  if (isFailure(writeResult)) return writeResult

  //  Log a message out the user indicating the location of the file
  yield log(`\nRepos Written From Github To File: ${writeResult.payload.realpath}`)

  return writeResult
}

module.exports = {
  saveRepositories
}
```

### Test It
Fourth, test your business logic using logic-less tests.  Each tuple in the array is an input-output pair.  You can find this in [`demo-cli/functions/save-repositories.spec.js`](https://github.com/orourkedd/effects-as-data/blob/master/src/demo-cli/functions/save-repositories.spec.js):
```js
const { testIt } = require('../../test')
const { saveRepositories } = require('./save-repositories')
const { userInput, httpGet, writeFile, log } = require('../actions')
const { printRepository } = require('./helpers')
const { success, failure } = require('../../util')

const testSaveRepositories = testIt(saveRepositories)

describe('saveRepositories()', () => {
  it('should get repositories and save to disk', testSaveRepositories(() => {
    const repos = [{name: 'test', git_url: 'git://...'}]
    const reposListFormatted = 'test: git://...'
    const writeFileResult = success({path: 'repos.json', realpath: 'r/repos.json'})
    return [
      ['repos.json', userInput('\nEnter a github username: ')],
      ['orourkedd', httpGet('https://api.github.com/users/orourkedd/repos')],
      [repos, printRepository(reposListFormatted, 'orourkedd')],
      [[], writeFile('repos.json', JSON.stringify(repos))],
      [writeFileResult, log('\nRepos Written From Github To File: r/repos.json')],
      [undefined, writeFileResult]
    ]
  }))

  it('should return http GET failure', testSaveRepositories(() => {
    const httpError = new Error('http error!')
    return [
      ['repos.json', userInput('\nEnter a github username: ')],
      ['orourkedd', httpGet('https://api.github.com/users/orourkedd/repos')],
      [failure(httpError), failure(httpError)]
    ]
  }))

  it('should return write file error', testSaveRepositories(() => {
    const repos = [{name: 'test', git_url: 'git://...'}]
    const reposListFormatted = 'test: git://...'
    const writeError = new Error('write error!')
    //  3 log actions return 3 success results
    const printResult = [success(), success(), success()]
    return [
      ['repos.json', userInput('\nEnter a github username: ')],
      ['orourkedd', httpGet('https://api.github.com/users/orourkedd/repos')],
      [repos, printRepository(reposListFormatted, 'orourkedd')],
      [printResult, writeFile('repos.json', JSON.stringify(repos))],
      [failure(writeError), failure(writeError)]
    ]
  }))
})

```

### Debug
If your tests are failing, you get a message like this:

```
Error on Step 4

Actual:
{ type: 'writeFile',
  path: 'wrong-path.json',
  data: '...
}

Expected:
{ type: 'writeFile',
  path: 'repos.json',
  data: '...'
}
```

### Wire It Up and Run It
Fifth, wire it all up.  You can find this in [`demo-cli/index.js`](https://github.com/orourkedd/effects-as-data/blob/master/src/demo-cli/index.js):
```js
const { run } = require('../index')
const handlers = require('./handlers')
const { saveRepositories } = require('./functions/save-repositories')

const outputFile = 'repos.json'

run(handlers, saveRepositories, outputFile).catch(console.error)

```

## Logging Action Failures

Logging all action failures explicitly can add a lot of noise to your code.  Effects-as-data provides an `onFailure` hook that will be called for each failed action with a detailed payload about the error:

```js

function onFailure (payload) {
  //  payload:
  //  {
  //   fn: 'testFunction',
  //   log: [
  //     [42, {type: 'firstAction'}],
  //     [{success: true, payload: 'something from firstAction'}, {type: 'theFailingAction'}]
  //   ],
  //   errorMessage: 'Oh No!',
  //   errorName: 'TypeError',
  //   errorStack: the stack trace,
  //   error: the error object
  // }
  log(payload)
}

function * test () {
  yield { type: 'firstAction' }
  yield { type: 'theFailingAction' }
}

return run(handlers, test, 42, {
  name: 'testFunction',
  onFailure
})
```

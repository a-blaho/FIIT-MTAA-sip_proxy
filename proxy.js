const sip = require('sip')
const proxy = require('sip/proxy')
const os = require('os')
const fs = require('fs')

const ADDRESS = os.networkInterfaces()['Wi-Fi'][1].address

let db = {}

//function to log data
function logData(req) {
  let date = new Date();
  let timestamp = `[${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}]`
  if(req.method == 'ACK')
    fs.appendFileSync('log.txt', `${timestamp} Call start:  ${req.headers.from.uri} -> ${req.headers.to.uri}\n`, (err) => {
      if (err) {
          throw err;
      }
    })
  else if(req.method == 'BYE') 
    fs.appendFileSync('log.txt', `${timestamp} Call end: ${req.headers.from.uri} -> ${req.headers.to.uri}\n`, (err) => {
      if (err) {
          throw err;
      }
    })
  else if(req.reason == 'Decline')
    fs.appendFileSync('log.txt', `${timestamp} Call declined: ${req.headers.from.uri} -> ${req.headers.to.uri}\n`, (err) => {
      if (err) {
          throw err;
      } 
    })
  else if(req.reason == 'Busy here')
    fs.appendFileSync('log.txt', `${timestamp} Call missed: ${req.headers.from.uri} -> ${req.headers.to.uri}\n`, (err) => {
      if (err) {
          throw err;
      }
    })
}

proxy.start({
  address: ADDRESS,
  port: 5060,
},
(req) => {
  switch(req.method) {
    //user registration
    case 'REGISTER':
      //store user into database
      let newUser = sip.parseUri(req.headers.to.uri).user
      db[newUser] = req.headers.contact
      //create a response and respond to client with a custom message
      let res = sip.makeResponse(req, 200, 'Okay')
      proxy.send(res)
      break
    //HANDLER FOR OTHER REQUESTS
    default:
      let user = sip.parseUri(req.uri).user
      if(db[user] && Array.isArray(db[user]) && db[user].length > 0) {
        req.uri = db[user][0].uri
        //fix port, so that requests don't bypass the proxy
        if (req.headers.contact) {
          let uri = `sip:${sip.parseUri(req.headers.contact[0].uri).user}@${ADDRESS}:5060`
          req.headers.contact[0].uri = uri
        } 
        logData(req)
        //forward the request and wait for reply
        proxy.send(req, (res) => {
          //we need to strip the top via, because we are using custom callback
          res.headers.via.shift();
          //fix port, so that requests don't bypass the proxy
          if (res.headers.contact) {
            let uri = `sip:${sip.parseUri(res.headers.contact[0].uri).user}@${ADDRESS}:5060`
            res.headers.contact[0].uri = uri
          }
          logData(res)
          proxy.send(res)
        })
      }
      else {
        //custom message
        proxy.send(sip.makeResponse(req, 404, 'User was not found'))
      }
      break
  }
})

console.log('Proxy running at', ADDRESS)
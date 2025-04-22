import Corestore from 'spacecorestore'
import ram from 'random-access-memory'
import Spaceswarm from 'spaceswarm'
import SwarmManager from './index.js'

const store = new Corestore(ram)

const swarm = new Spaceswarm()
swarm.on('connection', (socket) => {
  store.replicate(socket)
  socket.on('error', () => {})
})

const manager = new SwarmManager(swarm)

// Some dummy discovery keys
const keys = [
  'a'.repeat(64),
  'b'.repeat(64)
]

manager.serve(keys[0])
manager.serve(keys[1])
manager.request(keys[1])
manager.serve(keys[1]) // served twice

console.log('Served keys:')
printKeys(manager.servedKeys)

console.log('requested keys:')
printKeys(manager.requestedKeys)

await manager.unserve(keys[1]) // still served once
console.log('\nServed keys after one unserve:')
printKeys(manager.servedKeys)

console.log('Requested keys after one unserve:')
printKeys(manager.requestedKeys)

await manager.unserve(keys[1]) // no longer served--still requested
console.log('\nServed keys after second unserve:')
printKeys(manager.servedKeys)

console.log('Requested keys after second unserve:')
printKeys(manager.requestedKeys)

await manager.unrequest(keys[1]) // no longer requested
console.log('\nFinal served keys:')
printKeys(manager.servedKeys)

console.log('Final requested keys:')
printKeys(manager.requestedKeys)

await manager.close()

function printKeys (keys) {
  if (keys.length === 0) {
    console.log('/')
  } else {
    console.log(` - ${keys.map(key => key.toString('hex')).join('\n - ')}`)
  }
}

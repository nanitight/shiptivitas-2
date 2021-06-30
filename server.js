const express = require('express');
const Database = require('better-sqlite3');
const { Router } = require('express');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  console.log('clients:',clients) ;

  return res.status(200).send({'message': 'SHIPTIVITY API. Read documentation to see API docs'});
});

// We are keeping one connection alive for the rest of the life application for simplicity
const db = new Database('./clients.db');

// Don't forget to close connection when server gets terminated
const closeDb = () => db.close();
process.on('SIGTERM', closeDb);
process.on('SIGINT', closeDb);

/**
 * Validate id input
 * @param {any} id
 */
const validateId = (id) => {
  if (Number.isNaN(id)) {
    return {
      valid: false,
      messageObj: {
      'message': 'Invalid id provided.',
      'long_message': 'Id can only be integer.',
      },
    };
  }
  const client = db.prepare('select * from clients where id = ? limit 1').get(id);
  if (!client) {
    return {
      valid: false,
      messageObj: {
      'message': 'Invalid id provided.',
      'long_message': 'Cannot find client with that id.',
      },
    };
  }
  return {
    valid: true,
  };
}

/**
 * Validate priority input
 * @param {any} priority
 */
const validatePriority = (priority) => {
  if (Number.isNaN(priority)|| priority<1) {
    return {
      valid: false,
      messageObj: {
      'message': 'Invalid priority provided.',
      'long_message': 'Priority can only be positive integer.',
      },
    };
  }
  return {
    valid: true,
  }
}

/**
 * Get all of the clients. Optional filter 'status'
 * GET /api/v1/clients?status={status} - list all clients, optional parameter status: 'backlog' | 'in-progress' | 'complete'
 */
app.get('/api/v1/clients', (req, res) => {
  const status = req.query.status;
  if (status) {
    // status can only be either 'backlog' | 'in-progress' | 'complete'
    if (status !== 'backlog' && status !== 'in-progress' && status !== 'complete') {
      return res.status(400).send({
        'message': 'Invalid status provided.',
        'long_message': 'Status can only be one of the following: [backlog | in-progress | complete].',
      });
    }
    const clients = db.prepare('select * from clients where status = ?').all(status);
    return res.status(200).send(clients);
  }
  const statement = db.prepare('select * from clients');
  const clients = statement.all();
  return res.status(200).send(clients);
});

/**
 * Get a client based on the id provided.
 * GET /api/v1/clients/{client_id} - get client by id
 */
app.get('/api/v1/clients/:id', (req, res) => {
  const id = parseInt(req.params.id , 10);
  const { valid, messageObj } = validateId(id);
  if (!valid) {
    res.status(400).send(messageObj);
  }
  return res.status(200).send(db.prepare('select * from clients where id = ?').get(id));
});

/**
 * Update client information based on the parameters provided.
 * When status is provided, the client status will be changed
 * When priority is provided, the client priority will be changed with the rest of the clients accordingly
 * Note that priority = 1 means it has the highest priority (should be on top of the swimlane).
 * No client on the same status should not have the same priority.
 * This API should return list of clients on success
 *
 * PUT /api/v1/clients/{client_id} - change the status of a client
 *    Data:
 *      status (optional): 'backlog' | 'in-progress' | 'complete',
 *      priority (optional): integer,
 *
 */
app.put('/api/v1/clients/:id', (req, res) => {
  const id = parseInt(req.params.id , 10);
  const { valid, messageObj } = validateId(id);
  if (!valid) {
    res.status(400).send(messageObj);
  }

  let {status, priority } = req.body;
  let clients = db.prepare('select * from clients order by priority').all();
  const client = clients.find(client => client.id === id);

  /* ---------- Update code below ----------*/
    //did it change status?
    //0 do nothing
    console.log('here', req.body)
    // console.log('clients:',clients) ;
    const statusChange = status ;
    if (statusChange!== undefined && statusChange !== 'backlog' && statusChange !== 'in-progress' && statusChange !== 'complete') {
      return res.status(400).send({
        message:'In valid status',
        long_message:'status can only be [backlog | in-progress | complete]' 
      }) ;
    } //wrong word on status
    else if (statusChange === undefined){
      console.log('no change') ;
      return res.status(200).send(clients);
    }//status does not exist
    //1 - Update status of id id
    // else
    //
    //priority after input? with input ?
    const parsedPriority = priority === undefined ? priority: parseInt(priority,10);
    var {valid:validatedPriority,messageObj:msg} = validatePriority(parsedPriority) ;
    if (!validatedPriority){
      //not valid priority
      return res.status(400).send({
        messageObj:msg
      }) ;
    }

    if (statusChange === client.status){
      //no change in location
      //priority?
      if (parsedPriority === client.priority || parsedPriority === undefined){
        // no change 
        console.log('no change') ;
        return res.status(200).send(clients);
      }
      else if (parsedPriority<client.priority){
      
        //get all in order of priority
        //update all in the criteria - * great than updated one in status lane
        const runUpdate = db.prepare('update clients set priority=? where status = ? and id = ?').run(parsedPriority,statusChange,id);
        const trigger = db.prepare('update clients set priority = priority + 1 where priority >= ? and status = ? and id != ? ').run(parsedPriority,statusChange,id) ;
        console.log(runUpdate,'Triger ... Move Up',trigger) ; 
        // if (runUpdate.changes < 0){
          
        // }
      }
      else{
        // update ones less than
        const runUpdate = db.prepare('update clients set priority=? where status = ? and id = ?').run(parsedPriority,statusChange,id);
        const trigger = db.prepare('update clients set priority = priority - 1 where priority <= ? and status = ? and id != ? ').run(parsedPriority,statusChange,id) ;
        console.log(runUpdate,'Triger ... Move Down',trigger) ; 

      }
      const updatedClients = db.prepare('select * from clients').all();
      // const updatedClients = db.prepare('select * from clients where status = ? order by priority').all(statusChange);
      // console.log(' changes ',updatedClients) ;

      return res.status(200).send(updatedClients);

    }
    else{
      // changes in location
      // at the bottom
      const lenOfStatus = db.prepare('select* from clients where status=?').all(statusChange).length ;
      // console.log('length: ',lenOfStatus)
      if ( parsedPriority === undefined || parsedPriority > lenOfStatus){
          const addToNew = db.prepare('update clients set status = ? , priority = ? where id = ? ').run(statusChange,lenOfStatus+1,id) ; 
          console.log('info of update',addToNew) ;
      }
      //desired location
      const runUpdate = db.prepare('update clients set priority=? where status = ? and id = ?').run(parsedPriority,statusChange,id);
      const trigger = db.prepare('update clients set priority = priority + 1 where priority >= ? and status = ? and id != ? ').run(parsedPriority,statusChange,id) ;
      // console.log(runUpdate,'Triger ... Move Up',trigger) ; 
  

      const updatedClients = db.prepare('select * from clients').all(statusChange);
      // console.log('major changes ',updatedClients) ;

      return res.status(200).send(updatedClients);

    }

});

app.listen(3001);
console.log('app running on port ', 3001);

// module.exports = app ;

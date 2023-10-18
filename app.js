require('./config/db');

const app=require('express')();
const port = process.env.PORT;
const UserRouter = require('./api/User');

const bodyParser = require('express').json;
app.use(bodyParser());
const cors = require('cors');

app.use(cors());

app.use('/user', UserRouter)




app.listen(port, '0.0.0.0',()=>{
    console.log(`Server running on port ${port}`);
})

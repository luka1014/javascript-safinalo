const express = require('express');
const cors    = require('cors');

const app = express();


app.use(cors());

app.use(express.json());


const eventsRouter        = require('./routes/events');
const registrationsRouter = require('./routes/registrations');

app.use('/api/events', eventsRouter);
app.use('/api/events', registrationsRouter);



app.get('/', (req, res) => {
  res.json({ message: 'სერვერი მუშაობს!' });
});


const PORT = 3000;

app.listen(PORT, () => {
  console.log(`სერვერი გაეშვა: http://localhost:${PORT}`);
});
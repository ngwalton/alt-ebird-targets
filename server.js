const express = require('express');
const app = express();

// put static files here, e.g. css, js, static html
app.use(express.static('public'));

// use ejs as the view manager
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index')
});

// http://localhost:3000/
app.listen(3000);

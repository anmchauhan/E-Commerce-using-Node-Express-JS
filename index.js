var express = require('express');
var ejs = require('ejs');
var bodyParser = require('body-parser');
var mysql = require('mysql');
var session =  require('express-session');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const nodemailer = require('nodemailer');

var connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "node_project"
});

connection.connect(function(err) {
  if (err) {
    console.error('Error connecting to database: ' + err.stack);
    return;
  }
  console.log('Connected to database with thread ID: ' + connection.threadId);
});

var app = express();

app.use(session({secret:"secret"}));

app.use(express.static('public'));
app.set('view engine', 'ejs');


app.listen(8080);
app.use(bodyParser.urlencoded({ extended: true }));



function isProductInCart(cart,id){

    for(let i=0; i<cart.length; i++){
        if(cart[i].id == id){
            return true;
        }
    }
    return false;
}

function calculateTotal(cart, req) {
  let total = 0;
  for (let i = 0; i < cart.length; i++) {
      // if we are offering a discounted price
      if (cart[i].sale_price) {
          total += cart[i].sale_price * cart[i].quantity; // Fix typo: removed * cart[i] before quantity
      } else {
          total += cart[i].price * cart[i].quantity;
      }
  }
  req.session.total = total;
  return total;
}

// Serve the login page
app.get('/login', function (req, res) {
  res.render('pages/login');
});

// Serve the signup page
app.get('/signup', function (req, res) {
  res.render('pages/signup');
});

app.post('/logout', function(req, res) {
  // Clear the session data
  req.session.destroy(function(err) {
    if (err) {
      console.error('Error destroying session: ' + err.stack);
      return;
    }
    // Redirect the user to the login page or any other page
    res.redirect('/login');
  }); 
});



// Signup route
// Signup route
app.post('/signup', bodyParser.urlencoded({ extended: true }), (req, res) => {
  // Retrieve the username, password, and email from the request body
  const { username, password, email } = req.body;

  // Hash the password using MD5
  const hashedPassword = CryptoJS.MD5(password).toString();

  // Insert the new user into the 'users' table
  const query = 'INSERT INTO users (username, password, email) VALUES (?, ?, ?)';
  connection.query(query, [username, hashedPassword, email], (err, result) => {
    if (err) {4
      console.error('Error inserting user into database: ', err);
      res.send('Signup failed!');
    } else {
      // Redirect the user to the login page
      res.redirect('/login');
    }
  });
});

  
  

// Login route
app.post('/login', bodyParser.urlencoded({ extended: true }), (req, res) => {
  // Retrieve the username and password from the request body
  const { username, password } = req.body;

  // Hash the password using MD5
  const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

  // Retrieve the user from the 'users' table
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  connection.query(query, [username, hashedPassword], (err, result) => {
    if (err) {
      console.error('Error retrieving user from database: ', err);
      res.send('Login failed!');
    } else {
      if (result.length > 0) {
        // Store the user ID in the session
        req.session.userId = result[0].id;
        res.redirect('/indexafterlogin');
      } else {
        res.send('Invalid credentials!');
      }
    }
  });
});

  

app.get('/', function(req, res) {
  connection.query("SELECT * FROM products", function(err, result) {
    if (err) {
      console.error('Error executing the database query: ' + err.stack);
      return;
    }
    res.render('pages/index', { result: result });
  });
});

app.get('/indexafterlogin', function(req, res) {
  connection.query("SELECT * FROM products", function(err, result) {
    if (err) {
      console.error('Error executing the database query: ' + err.stack);
      return;
    }
    res.render('pages/indexafterlogin', { result: result });
  });
});

app.post('/add_to_cart',function(req,res){

    var id= req.body.id;
    var name= req.body.name;
    var price= req.body.price;
    var sale_price= req.body.sale_price;
    var quantity= req.body.quantity;
    var image= req.body.image;
    var product = {id:id,name:name,price:price,sale_price:sale_price,quantity:quantity,image:image};

    if(req.session.cart){
        var cart = req.session.cart;

        if(!isProductInCart(cart,id)){
            cart.push(product);
        }
    }else{

        req.session.cart = [product];
        var cart = req.session.cart;

    }

    //calculate total
    calculateTotal(cart,req)
    res.redirect('/cart');

});

app.get('/cart', function(req, res) {
  // Check if the user is logged in
  if (!req.session.userId) {
    res.redirect('/login');
    return;
  }
  
  var cart = req.session.cart;
  var total = req.session.total;

  res.render('pages/cart', { cart: cart, total: total });
});


app.post('/remove_product', function(req,res){
  var id = req.body.id;
  var cart = req.session.cart;
  for(let i=0; i<cart.length; i++){
    if(cart[i].id==id){
      cart.splice(cart.indexOf(i),1)
    }
  }

  //re-calculate
  calculateTotal(cart,req);
  res.redirect('/cart');
});

app.post('/edit_product_quantity', function(req, res) {

  //get values from inputs
  var id = req.body.id;
  var quantity = req.body.quantity;
  var increase_btn = req.body.increase_product_quantity;
  var decrease_btn = req.body.decrease_product_quantity;

  var cart = req.session.cart;

  if (increase_btn) {
    for (let i = 0; i < cart.length; i++) {
      if (cart[i].id == id) {
        if (cart[i].quantity > 0) {
          cart[i].quantity = parseInt(cart[i].quantity) + 1;
        }
      }
    }
  }

  if (decrease_btn) {
    for (let i = 0; i < cart.length; i++) {
      if (cart[i].id == id) {
        if (cart[i].quantity > 1) {
          cart[i].quantity = parseInt(cart[i].quantity) - 1;
        }
      }
    }
  }

  calculateTotal(cart, req);
  res.redirect('/cart');
});

app.post('/delete_user', bodyParser.urlencoded({ extended: true }), (req, res) => {
  // Retrieve the user ID from the request body
  const { userId } = req.body;

  // Delete the user from the 'users' table
  const query = 'DELETE FROM users WHERE id = ?';
  connection.query(query, [userId], (err, result) => {
      if (err) {
          console.error('Error deleting user from database: ', err);
          res.status(500).send('Deletion failed!');
      } else {
          // User deleted successfully
          res.sendStatus(200);
      }
  });
});


app.post('/delete_order', (req, res) => {
  // Retrieve the order ID from the request body
  const orderId = req.body.orderId;

  // Perform the deletion of the order entry in your data storage (e.g., database)
  const query = 'DELETE FROM orders WHERE id = ?';
  connection.query(query, [orderId], (err, result) => {
    if (err) {
      console.error('Error deleting order from database: ', err);
      res.sendStatus(500); // Internal Server Error
    } else {
      // Return a response indicating the success of the deletion
      res.sendStatus(200); // OK
    }
  });
});




app.get('/checkout', function(req, res) {
  var total = req.session.total;
  res.render('pages/checkout', {total: total});
});


app.get('/about', function(req, res) {
  res.render('pages/about', {});
});

app.get('/brand', function(req, res) {
  res.render('pages/brand', {});
});

app.get('/special', function(req, res) {
  res.render('pages/special', {});
});

app.get('/contact', function(req, res) {
  res.render('pages/contact', {});
});


app.post('/place_order', function(req, res) {
  var name = req.body.name;
  var email = req.body.email;
  var phone = req.body.phone;
  var city = req.body.city;
  var address = req.body.address;
  var cost = req.session.total;
  var status = "not paid";
  var date = new Date();
  var products_ids = "";

  var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "node_project"
  });

  var cart = req.session.cart;
  for (let i = 0; i < cart.length; i++) {
    products_ids = products_ids + "," + cart[i].id;
  }

  con.connect((err) => {
    if (err) {
      console.log(err);
      res.redirect('/checkout');
      return;
    }

    var query = "INSERT INTO orders(cost,name,email,status,city,address,phone,date,products_ids) VALUES ?";
    var values = [[cost, name, email, status, city, address, phone, date, products_ids]];
    con.query(query, [values], (err, results) => {
      if (err) {
        console.log(err);
        res.redirect('/checkout');
        return;
      }

      // Send email to the user
      var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: 'anmchauhan143@gmail.com',
          pass: 'jyylgmdrahlqaicr'
        }
      });

      var mailOptions = {
        from: 'anmchauhan143@gmail.com',
        to: email,
        subject: 'Order Confirmation',
        text: `Dear ${name},\n\nThank you for your purchase!\nYour order will be shipped soon.\n\nTotal Bill $: ${cost}\n\nThank you!\n`
      };

      transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });

      res.redirect('/payment');
    });
  });
});


app.get('/payment', function(req, res) {
  var total = req.session.total;
  res.render('pages/payment', { total: total });
});

// Serve the staff login page
app.get('/staff-login', function(req, res) {
  res.render('pages/staff-login');
});

// Handle the staff login request
app.post('/staff-login', bodyParser.urlencoded({ extended: true }), (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  // Check if the credentials are correct (fixed credentials: username: "staff", password: "milople")
  if (username === 'staff' && password === 'milople') {
    // Create a connection to the database
    const connection = mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "",
      database: "node_project"
      // Your database connection configuration here
    });

    // Connect to the database
    connection.connect((err) => {
      if (err) {
        console.error('Error connecting to the database: ', err); // Log the error
        res.send('An error occurred while connecting to the database: ' + err.message); // Send the error message to the client
        return;
      }

      // Fetch data from the "orders" table
      connection.query('SELECT * FROM orders', (err, orderResults) => {
        if (err) {
          console.error('Error retrieving orders from the database: ', err); // Log the error
          res.send('An error occurred while fetching the data: ' + err.message); // Send the error message to the client
          return;
        }

        // Fetch data from the "products" table
        connection.query('SELECT * FROM products', (err, productResults) => {
          if (err) {
            console.error('Error retrieving products from the database: ', err); // Log the error
            res.send('An error occurred while fetching the data: ' + err.message); // Send the error message to the client
            return;
          }

          // Fetch data from the "users" table
          connection.query('SELECT * FROM users', (err, userResults) => {
            if (err) {
              console.error('Error retrieving users from the database: ', err); // Log the error
              res.send('An error occurred while fetching the data: ' + err.message); // Send the error message to the client
              return;
            }

            // Render the data in the frontend or perform any other actions
            res.render('pages/staff-dashboard', {
              orders: orderResults,
              products: productResults,
              users: userResults
            });

            // Close the database connection
            connection.end((err) => {
              if (err) {
                console.error('Error closing the database connection: ', err); // Log the error
              }
            });
          });
        });
      });
    });
  } else {
    res.send('Invalid credentials');
  }
});

app.post('/update_quantity', function(req, res) {
  var id = req.body.id;
  var quantity = parseInt(req.body.quantity);
  var cart = req.session.cart;

  // Update the quantity for the corresponding product
  cart.forEach(function(item) {
    if (item.id === id) {
      item.quantity = quantity;
    }
  });

  // Calculate the updated subtotal and total
  var subtotal = 0;
  cart.forEach(function(item) {
    subtotal += item.price * item.quantity;
  });
  var total = subtotal;

  res.json({ subtotal: subtotal, total: total });
});

// Assuming you have already set up your server using Express

// POST endpoint for adding a new user
let users = [];
app.post('/add_user', (req, res) => {
  // Extract the username and password from the request body
  const { username, password } = req.body;

  // Perform any necessary validation on the username and password
  // For example, check for empty values or validate against specific rules

  // Assuming you have a users array to store user objects
  const newUser = {
    id: generateUniqueId(), // You can generate a unique ID for the new user
    username,
    password
  };

  // Add the new user to the users array
  users.push(newUser);

  // Optionally, you can send a response back to the client indicating success
  res.status(200).json({ message: 'User added successfully', user: newUser });
});

// // Start the server
// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });

require('dotenv').config()
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const server = express();
const port = 3000;

server.use(express.urlencoded({ extended: true }));
server.use(express.json());

server.get('/products', async (req, res) => {
    //https://stripe.com/docs/api/products/list
    let allproducts = await stripe.products.list({});
    res.send(allproducts);
});

server.get('/prices', async (req, res) => {
    //https://stripe.com/docs/api/products/list
    let allprices = await stripe.prices.list({});
    res.send(allprices);
});

server.get('/products/:id', async (req, res) => {
    var productId = null;
    productId = req.params.id;
    const product = await stripe.products.retrieve(
        productId
    );
    res.send(product);
});

//single cutomer, show
server.get('/customers/:id', async (req, res) => {
    try {
        var customer = await stripe.customers.retrieve(req.params.id);
    } catch (err) {
        if (err.statusCode == 404) {
            res.sendStatus(err.statusCode);
        }
    }
    res.send(customer);
});

//single product, update
server.post('/products', async (req, res) => {
    let newskus = req.body.skus;
    var products = req.body.productids;
    try {
        products.forEach(updateProduct);
    } catch (err) {
        console.log(err);
        res.sendStatus(err.statusCode);
    }

    async function updateProduct(element, idx) {
        product = await stripe.products.update(products[idx], { metadata: { sku: newskus[idx] } });
    }

    res.sendStatus(200);
});

server.post('/checkout', async (req, res) => {
    // Use an existing Customer ID if this is a returning customer.
    let products = req.body.products;
    let prices = req.body.prices;
    let quantities = req.body.quantities;

    //stock shorting check
    quantities.forEach(checkitemstock);
    async function checkitemstock(element, idx) {
        if (quantities[idx] > 0) {
            try {
                let product = await stripe.products.retrieve(
                    products[idx]
                );
                let sku = product["metadata"]["sku"];
                let checkStock = parseInt(sku) - quantities[idx];
                if (checkStock < 0) {
                    res.sendStatus(200);
                    res.send('Some items are out of stock.Sorry.');
                    return
                }
            } catch (err) {
                console.log(err);
                res.sendStatus(err.statusCode);
            }
        }
    }

    let total_amount = products.reduce(calculate, 0, 0);
    function calculate(sum, num, idx) {
        var thePrice = prices[idx];
        thePrice = thePrice.split('.').join("");
        thePrice = parseInt(thePrice);
        let theQty = parseInt(quantities[idx]);
        let theMultiplied = thePrice * theQty;
        return sum + theMultiplied;
    }

    var customerId = req.body.customerId;
    var customer = null;
    try {
        customer = await stripe.customers.retrieve(customerId);
    } catch (err) {
        if (err.statusCode == 404) {
        }
    }

    if (!customer) {//meaning customer == null
        customer = await stripe.customers.create();
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customer.id },
        { apiVersion: '2020-08-27' }
    );

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: total_amount,
            currency: 'usd',
            customer: customer.id,
            description: 'none'
        });
        res.json({
            paymentIntent: paymentIntent.client_secret,
            ephemeralKey: ephemeralKey.secret,
            customer: customer.id
        });
    } catch (err) {
        res.sendStatus(err.statusCode);
    }
});

server.listen(process.env.PORT || port, () => {
    console.log(`Example a:: listening at htttp://localhost:${port}`);
})
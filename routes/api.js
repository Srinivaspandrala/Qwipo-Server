const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const router = express.Router();

const dbPath = path.join(__dirname, '../database/customers_1.db');

// Helper function to open database connection
const openDb = () => {
  return new sqlite3.Database(dbPath);
};

// Get all customers with pagination (should support searching, sorting, and pagination).
router.get('/customers', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || 'id';
  const order = req.query.order || 'ASC';
  const search = req.query.search || '';
  const city = req.query.city || '';
  
  const db = openDb();
  
  let query = `SELECT * FROM customers`;
  let countQuery = `SELECT COUNT(*) as total FROM customers`;
  let params = [];
  // Build WHERE clause with optional search and city filters
  let whereClauses = [];
  if (search) {
    whereClauses.push('(first_name LIKE ? OR last_name LIKE ? OR phone_number LIKE ? OR city LIKE ?)');
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }
  if (city) {
    whereClauses.push('city = ?');
    params.push(city);
  }
  if (whereClauses.length > 0) {
    const where = ' WHERE ' + whereClauses.join(' AND ');
    query += where;
    countQuery += where;
  }
  query += ` ORDER BY ${sortBy} ${order} LIMIT ? OFFSET ?`;
  
  db.all(countQuery, params, (err, countResult) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    db.all(query, [...params, limit, offset], (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({
        customers: rows,
        pagination: {
          current: page,
          total: totalPages,
          limit: limit,
          totalRecords: total
        }
      });
    });
  });
  
  db.close();
});

// Get a single customer by ID
router.get('/customers/:id', (req, res) => {
  const db = openDb();
  
  db.get('SELECT * FROM customers WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    // Get addresses for this customer
    db.all('SELECT * FROM addresses WHERE customer_id = ?', [req.params.id], (err, addresses) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({
        ...row,
        addresses: addresses
      });
    });
  });
  
  db.close();
});

// Create a new customer
router.post('/customers', (req, res) => {
  const { first_name, last_name, phone_number,city } = req.body;
  console.log(req.body);
  // Validation
  if (!first_name || !last_name || !phone_number ||!city) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  const db = openDb();
  // Check if phone number already exists
  db.get('SELECT id FROM customers WHERE phone_number = ?', [phone_number], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      res.status(400).json({ error: 'Phone number already exists' });
      return;
    }
    // Insert new customer
    const sql = `INSERT INTO customers (first_name, last_name, phone_number,city) VALUES (?, ?, ?,?)`;
    db.run(sql, [first_name, last_name, phone_number,city], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        message: 'Customer created successfully',
        customerId: this.lastID
      });
    });
  });
  db.close();
});

// Update a customer information
router.put('/customers/:id', (req, res) => {
  const { first_name, last_name, phone_number, city } = req.body;
  // Basic validation
  if (!first_name || !last_name || !phone_number || !city) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Normalize phone to digits only for storage/comparison
  const normalizedPhone = String(phone_number).replace(/\D/g, '');

  const db = openDb();

  // Check if phone number already exists for another customer
  db.get('SELECT id FROM customers WHERE phone_number = ? AND id != ?', [normalizedPhone, req.params.id], (err, row) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: err.message });
    }
    if (row) {
      db.close();
      return res.status(400).json({ error: 'Phone number already exists for another customer' });
    }

    // Update customer
    const sql = `UPDATE customers SET first_name = ?, last_name = ?, phone_number = ?, city = ? WHERE id = ?`;
    db.run(sql, [first_name, last_name, normalizedPhone, city, req.params.id], function(err) {
      if (err) {
        db.close();
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        db.close();
        return res.status(404).json({ error: 'Customer not found' });
      }
      db.close();
      return res.json({ message: 'Customer updated successfully' });
    });
  });
});

// Delete a customer
router.delete('/customers/:id', (req, res) => {
  const db = openDb();
  
  db.run('DELETE FROM customers WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    res.json({ message: 'Customer deleted successfully' });
  });
  
  db.close();
});

// Get addresses for a customer
router.get('/customers/:id/addresses', (req, res) => {
  const db = openDb();
  
  db.all('SELECT * FROM addresses WHERE customer_id = ?', [req.params.id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json(rows);
  });
  
  db.close();
});

// Add a new address for a customer
router.post('/customers/:id/addresses', (req, res) => {
  const { address_details, city, state, pin_code } = req.body;
  console.log(req.body);
  // Validation
  if (!address_details || !city || !state || !pin_code) {
    return res.status(400).json({ error: 'Address details, city, state, and pin code are required' });
  }
  const db = openDb();
  const sql = `INSERT INTO addresses (customer_id, address_details, city, state, pin_code) VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [req.params.id, address_details, city, state, pin_code], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: 'Address added successfully',
      addressId: this.lastID
    });
  });
  db.close();
});

// Update an address
router.put('/addresses/:id', (req, res) => {
  const { address_details, city, state, pin_code } = req.body;
  // Validation
  if (!address_details || !city || !state || !pin_code) {
    return res.status(400).json({ error: 'Address details, city, state, and pin code are required' });
  }
  const db = openDb();
  const sql = `UPDATE addresses SET address_details = ?, city = ?, state = ?, pin_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  db.run(sql, [address_details, city, state, pin_code, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }
    res.json({ message: 'Address updated successfully' });
  });
  db.close();
});

// Delete an address
router.delete('/customers/:id', (req, res) => {
  db.run('DELETE FROM customers WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      handleDbError(res, err);
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    
    res.json({ message: 'Customer deleted successfully' });
  });
});


router.delete('/addresses/:id', (req, res) => {
  const db = openDb();
  
  db.run('DELETE FROM addresses WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }
    
    res.json({ message: 'Address deleted successfully' });
  });
  
  db.close();
});


module.exports = router;
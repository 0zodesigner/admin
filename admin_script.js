document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutButton = document.getElementById('logoutButton');
    const adminProductList = document.getElementById('adminProductList');
    const showAddProductFormButton = document.getElementById('showAddProductFormButton');
    const productFormContainer = document.getElementById('productFormContainer');
    const productForm = document.getElementById('productForm');
    const formTitle = document.getElementById('formTitle');
    const productIdInput = document.getElementById('productId');
    const productNameInput = document.getElementById('productName');
    const productPriceInput = document.getElementById('productPrice');
    const productImageInput = document.getElementById('productImage');
    const productDescriptionInput = document.getElementById('productDescription');
    const cancelEditButton = document.getElementById('cancelEditButton');
    const productFormError = document.getElementById('productFormError');

    const backendAdminApiBaseUrl = 'http://127.0.0.1:5000/admin/api'; 
    const backendPublicApiBaseUrl = 'http://127.0.0.1:5000/api';

    // Helper function to make requests
    async function makeRequest(url, method = 'GET', body = null, needsAuth = false) {
        const options = {
            method: method,
            headers: {},
        };
        if (needsAuth) {
            options.credentials = 'include'; // Crucial for sending session cookies
        }
        if (body) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        console.log(`Making ${method} request to ${url} (Auth: ${needsAuth}) with options:`, options);
        
        const response = await fetch(url, options);
        console.log(`Response from ${url}: Status ${response.status}`);
        
        // Try to parse JSON regardless of status for error messages, but don't throw for 401 here
        let responseData = null;
        try {
            responseData = await response.json();
        } catch(e) {
            // If response is not JSON (e.g. empty for 204, or text for some errors)
            if (!response.ok && response.status !== 401) { // only throw if not OK and not specifically a 401
                 throw new Error(`Request failed with status ${response.status} and non-JSON response.`);
            }
            // For 200/201/204 with no JSON body, responseData remains null, which is fine.
        }

        if (!response.ok && response.status !== 401) { // Allow 401 to be handled by caller specifically
             throw new Error(responseData?.error || `Request failed with status ${response.status}`);
        }
        // Return both the response object and parsed data for flexibility
        return { response, data: responseData };
    }
    
    // REMOVED checkAuth function

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        loginError.textContent = '';
        const username = loginForm.username.value;
        const password = loginForm.password.value;
        try {
            // The 'true' for needsAuth is critical here
            const { response, data } = await makeRequest(`${backendAdminApiBaseUrl}/login`, 'POST', { username, password }, true);
            
            if (response.ok) {
                console.log("Login successful.");
                showDashboard();
                fetchAdminProducts(); // Fetch products after successful login
            } else {
                // data might be null if error response wasn't JSON
                loginError.textContent = data?.error || `Login failed (Status: ${response.status}).`;
            }
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = `An error occurred during login: ${error.message}`;
        }
    });

    logoutButton.addEventListener('click', async () => {
        try {
            await makeRequest(`${backendAdminApiBaseUrl}/logout`, 'POST', null, true);
            showLogin();
        } catch (error) { 
            console.error('Logout error:', error); 
            alert('Logout failed.'); 
        }
    });

    function showLogin() {
        loginSection.style.display = 'block'; 
        dashboardSection.style.display = 'none';
        logoutButton.style.display = 'none'; 
        productFormContainer.style.display = 'none';
        adminProductList.innerHTML = '<p>Please log in to manage products.</p>'; // Clear product list
    }

    function showDashboard() {
        loginSection.style.display = 'none'; 
        dashboardSection.style.display = 'block';
        logoutButton.style.display = 'block';
    }

    async function fetchAdminProducts() {
        adminProductList.innerHTML = '<p>Loading products...</p>';
        try { 
            const { response, data } = await makeRequest(`${backendPublicApiBaseUrl}/products`); // No auth needed for GET
            if (response.ok) {
                renderAdminProducts(data);
            } else {
                 adminProductList.innerHTML = `<p class="error-message">Could not load products: ${data?.error || `Status ${response.status}`}</p>`;
            }
        } catch (error) {
            console.error('Error fetching admin products:', error);
            adminProductList.innerHTML = `<p class="error-message">Could not load products: ${error.message}</p>`;
        }
    }

    function renderAdminProducts(products) {
        if (!products || products.length === 0) {
            adminProductList.innerHTML = '<p>No products available.</p>'; return;
        }
        const table = document.createElement('table');
        table.innerHTML = `
            <thead><tr><th>ID</th><th>Image</th><th>Name</th><th>Price</th><th>Actions</th></tr></thead>
            <tbody>
                ${products.map(p => `
                    <tr><td>${p.id}</td><td><img src="${p.image}" alt="${p.name}"></td>
                        <td>${p.name}</td><td>$${p.price.toFixed(2)}</td>
                        <td class="actions">
                            <button class="edit-btn" data-id="${p.id}">Edit</button>
                            <button class="delete-btn" data-id="${p.id}">Delete</button>
                        </td></tr>`).join('')}
            </tbody>`;
        adminProductList.innerHTML = ''; 
        adminProductList.appendChild(table);
        table.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => handleEditProduct(btn.dataset.id, products)));
        table.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDeleteProduct(btn.dataset.id)));
    }

    showAddProductFormButton.addEventListener('click', () => {
        formTitle.textContent = 'Add New Product'; 
        productForm.reset();
        productIdInput.value = ''; 
        productFormError.textContent = '';
        productFormContainer.style.display = 'block';
    });
    cancelEditButton.addEventListener('click', () => { 
        productFormContainer.style.display = 'none'; 
        productForm.reset(); 
    });

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        productFormError.textContent = '';
        const id = productIdInput.value;
        const productData = {
            name: productNameInput.value, 
            price: parseFloat(productPriceInput.value),
            image: productImageInput.value, 
            description: productDescriptionInput.value
        };

        if (isNaN(productData.price) || productData.price <= 0) {
            productFormError.textContent = 'Price must be a positive number.'; return;
        }

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${backendAdminApiBaseUrl}/products/${id}` : `${backendAdminApiBaseUrl}/products`;

        try {
            const { response, data } = await makeRequest(url, method, productData, true); // needsAuth = true
            
            if (response.ok) {
                productFormContainer.style.display = 'none'; 
                productForm.reset();
                fetchAdminProducts(); // Refresh product list
                alert(`Product ${id ? 'updated' : 'added'}!`);
            } else if (response.status === 401) {
                productFormError.textContent = data?.error || 'Unauthorized. Please log in again.';
                showLogin(); // Or prompt for login
            }
            else {
                productFormError.textContent = data?.error || `Failed to ${id ? 'update' : 'add'} product (Status: ${response.status}).`;
            }
        } catch (error) {
            console.error('Product form error:', error);
            productFormError.textContent = `An error occurred: ${error.message}`;
        }
    });

    function handleEditProduct(id, products) {
        const product = products.find(p => p.id == id);
        if (product) {
            formTitle.textContent = 'Edit Product'; 
            productIdInput.value = product.id;
            productNameInput.value = product.name; 
            productPriceInput.value = product.price;
            productImageInput.value = product.image; 
            productDescriptionInput.value = product.description;
            productFormError.textContent = ''; 
            productFormContainer.style.display = 'block';
        }
    }

    async function handleDeleteProduct(id) {
        if (!confirm(`Delete product ID ${id}?`)) return;
        try {
            const { response, data } = await makeRequest(`${backendAdminApiBaseUrl}/products/${id}`, 'DELETE', null, true); // needsAuth = true
            
            if (response.ok) {
                fetchAdminProducts(); // Refresh list
                alert(data?.message || 'Product deleted.');
            } else if (response.status === 401) {
                alert(data?.error || 'Unauthorized. Please log in again.');
                showLogin();
            } else {
                alert(data?.error || `Failed to delete (Status: ${response.status}).`);
            }
        } catch (error) { 
            console.error('Delete error:', error); 
            alert(`Error deleting: ${error.message}`); 
        }
    }
    
    // Initial Load for Admin Panel
    function initializeAdminApp() {
        console.log("Initializing Admin Panel App...");
        // No automatic checkAuth on load. User must log in.
        showLogin(); // Default to login screen
    }
    initializeAdminApp();
});
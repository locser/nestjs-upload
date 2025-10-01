# 🚀 useState Mastery - Từ Zero đến Hero trong 30 phút

> **🎯 Mục tiêu**: Hiểu hoàn toàn useState - hook quan trọng nhất của React và biết cách áp dụng vào dự án thực tế!

---

## 📚 **PHẦN 1: useState CƠ BẢN (10 phút đầu)**

### **🔥 useState là gì?**
- useState là một **React Hook** giúp bạn thêm **state** vào functional component
- **State** = dữ liệu có thể thay đổi và làm component re-render
- **Re-render** = React vẽ lại UI khi state thay đổi

### **🎯 Cú pháp cơ bản:**
```jsx
import { useState } from 'react';

function MyComponent() {
  const [state, setState] = useState(initialValue);
  //      ↑       ↑              ↑
  //   Giá trị  Hàm thay đổi   Giá trị ban đầu
  
  return <div>{state}</div>;
}
```

### **💡 Ví dụ 1: Counter đơn giản**
```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  const increment = () => {
    setCount(count + 1); // Tăng count lên 1
  };
  
  const decrement = () => {
    setCount(count - 1); // Giảm count xuống 1
  };
  
  return (
    <div>
      <h2>Count: {count}</h2>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
```

### **💡 Ví dụ 2: Text Input**
```jsx
function TextInput() {
  const [text, setText] = useState('');
  
  return (
    <div>
      <input 
        type="text" 
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Nhập gì đó..."
      />
      <p>Bạn đã nhập: {text}</p>
      <p>Độ dài: {text.length} ký tự</p>
    </div>
  );
}
```

### **🔥 HANDS-ON EXERCISE #1:**
**Tạo một component "Like Button":**
- Hiển thị số lượng like
- Button để tăng like
- Button để reset về 0
- Thay đổi màu khi like > 10

---

## 🚀 **PHẦN 2: useState NÂNG CAO (10 phút tiếp theo)**

### **🎯 useState với Object**
```jsx
function UserProfile() {
  const [user, setUser] = useState({
    name: '',
    email: '',
    age: 0
  });
  
  const updateName = (newName) => {
    setUser({
      ...user,        // Giữ nguyên các thuộc tính khác
      name: newName   // Chỉ thay đổi name
    });
  };
  
  const updateUser = (field, value) => {
    setUser(prevUser => ({
      ...prevUser,
      [field]: value  // Dynamic key update
    }));
  };
  
  return (
    <div>
      <input 
        placeholder="Name"
        onChange={(e) => updateUser('name', e.target.value)}
      />
      <input 
        placeholder="Email"
        onChange={(e) => updateUser('email', e.target.value)}
      />
      <input 
        type="number"
        placeholder="Age"
        onChange={(e) => updateUser('age', parseInt(e.target.value))}
      />
      
      <div>
        <h3>User Info:</h3>
        <p>Name: {user.name}</p>
        <p>Email: {user.email}</p>
        <p>Age: {user.age}</p>
      </div>
    </div>
  );
}
```

### **🎯 useState với Array**
```jsx
function TodoList() {
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState('');
  
  const addTodo = () => {
    if (inputValue.trim()) {
      const newTodo = {
        id: Date.now(),
        text: inputValue,
        completed: false
      };
      
      setTodos([...todos, newTodo]); // Thêm vào cuối array
      setInputValue(''); // Clear input
    }
  };
  
  const toggleTodo = (id) => {
    setTodos(todos.map(todo => 
      todo.id === id 
        ? { ...todo, completed: !todo.completed }
        : todo
    ));
  };
  
  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };
  
  return (
    <div>
      <div>
        <input 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Thêm todo mới..."
        />
        <button onClick={addTodo}>Add</button>
      </div>
      
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <span 
              style={{ 
                textDecoration: todo.completed ? 'line-through' : 'none' 
              }}
              onClick={() => toggleTodo(todo.id)}
            >
              {todo.text}
            </span>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### **⚡ Functional Updates - Pattern quan trọng!**
```jsx
function AdvancedCounter() {
  const [count, setCount] = useState(0);
  
  // ❌ WRONG: Có thể gây bug khi click nhanh
  const incrementWrong = () => {
    setCount(count + 1);
    setCount(count + 1); // Vẫn chỉ tăng 1, không phải 2!
  };
  
  // ✅ CORRECT: Dùng functional update
  const incrementCorrect = () => {
    setCount(prevCount => prevCount + 1);
    setCount(prevCount => prevCount + 1); // Sẽ tăng 2!
  };
  
  // ✅ Real-world example
  const handleMultipleClicks = () => {
    // Tăng 5 lần
    for (let i = 0; i < 5; i++) {
      setCount(prevCount => prevCount + 1);
    }
  };
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={incrementCorrect}>+2</button>
      <button onClick={handleMultipleClicks}>+5</button>
    </div>
  );
}
```

### **🔥 HANDS-ON EXERCISE #2:**
**Tạo Shopping Cart component:**
- Array products với id, name, price
- Thêm/xóa sản phẩm
- Tính tổng tiền
- Hiển thị số lượng items

---

## ⚡ **PHẦN 3: useState TRONG DỰ ÁN THỰC TẾ (10 phút cuối)**

### **🎯 Pattern 1: Form Handling**
```jsx
function ProductForm() {
  const [product, setProduct] = useState({
    name: '',
    price: 0,
    category: '',
    description: ''
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  
  const handleInputChange = (field, value) => {
    setProduct(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error khi user bắt đầu nhập
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!product.name.trim()) {
      newErrors.name = 'Tên sản phẩm là bắt buộc';
    }
    
    if (product.price <= 0) {
      newErrors.price = 'Giá phải lớn hơn 0';
    }
    
    if (!product.category) {
      newErrors.category = 'Vui lòng chọn danh mục';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Call API tạo sản phẩm
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(product)
      });
      
      if (response.ok) {
        alert('Tạo sản phẩm thành công!');
        // Reset form
        setProduct({
          name: '',
          price: 0,
          category: '',
          description: ''
        });
      }
    } catch (error) {
      alert('Có lỗi xảy ra: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          type="text"
          placeholder="Tên sản phẩm"
          value={product.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </div>
      
      <div>
        <input
          type="number"
          placeholder="Giá"
          value={product.price}
          onChange={(e) => handleInputChange('price', parseFloat(e.target.value))}
        />
        {errors.price && <span className="error">{errors.price}</span>}
      </div>
      
      <div>
        <select
          value={product.category}
          onChange={(e) => handleInputChange('category', e.target.value)}
        >
          <option value="">Chọn danh mục</option>
          <option value="electronics">Điện tử</option>
          <option value="clothing">Quần áo</option>
          <option value="books">Sách</option>
        </select>
        {errors.category && <span className="error">{errors.category}</span>}
      </div>
      
      <div>
        <textarea
          placeholder="Mô tả sản phẩm"
          value={product.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
        />
      </div>
      
      <button type="submit" disabled={loading}>
        {loading ? 'Đang tạo...' : 'Tạo sản phẩm'}
      </button>
    </form>
  );
}
```

### **🎯 Pattern 2: API Data Management**
```jsx
function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch products khi component mount
  useEffect(() => {
    fetchProducts();
  }, []);
  
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const deleteProduct = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa?')) return;
    
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Update state ngay lập tức (optimistic update)
        setProducts(products.filter(p => p.id !== id));
      }
    } catch (err) {
      alert('Xóa thất bại: ' + err.message);
    }
  };
  
  // Filter products dựa trên search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (loading) return <div>Đang tải...</div>;
  if (error) return <div>Lỗi: {error}</div>;
  
  return (
    <div>
      <input
        type="text"
        placeholder="Tìm kiếm sản phẩm..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      
      <div className="products-grid">
        {filteredProducts.map(product => (
          <div key={product.id} className="product-card">
            <h3>{product.name}</h3>
            <p>Giá: {product.price.toLocaleString()} VND</p>
            <p>{product.description}</p>
            <button onClick={() => deleteProduct(product.id)}>
              Xóa
            </button>
          </div>
        ))}
      </div>
      
      {filteredProducts.length === 0 && (
        <p>Không tìm thấy sản phẩm nào.</p>
      )}
    </div>
  );
}
```

### **🎯 Pattern 3: Multiple useState vs Single useState**
```jsx
// ❌ KHÔNG NÊN: Quá nhiều useState riêng lẻ
function BadExample() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState(0);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  // ... quá nhiều state
}

// ✅ TỐT HƠN: Nhóm related state lại
function GoodExample() {
  const [userInfo, setUserInfo] = useState({
    name: '',
    email: '',
    age: 0,
    address: '',
    phone: ''
  });
  
  const [formState, setFormState] = useState({
    loading: false,
    errors: {},
    submitted: false
  });
}
```

---

## 🎯 **TỔNG KẾT 30 PHÚT VỚI useState**

### **✅ Bạn đã học được:**
- **Cơ bản**: useState syntax, re-rendering
- **Primitive types**: string, number, boolean
- **Complex types**: object, array
- **Functional updates**: prevState pattern
- **Real-world patterns**: forms, API calls, validation
- **Best practices**: khi nào dùng single vs multiple state

### **🔥 CÁC LỖI THƯỜNG GẶP:**
1. **Mutating state trực tiếp**: `state.push()` thay vì `setState([...state, newItem])`
2. **Quên functional update**: `setState(state + 1)` thay vì `setState(prev => prev + 1)`
3. **Async setState**: Nghĩ setState là sync, thực ra là async
4. **Quá nhiều useState**: Nên nhóm related state lại

### **🚀 THỰC HÀNH NGAY:**
1. **Tạo Counter với useState**
2. **Tạo Todo List đơn giản**
3. **Tạo Product Form kết nối API**
4. **Thực hành với NestJS backend của bạn**

---

## 📋 **CHECKLIST useState MASTERY**

### **✅ Kiến thức cơ bản:**
- [ ] Hiểu useState syntax
- [ ] Biết cách update primitive types
- [ ] Biết cách update objects và arrays
- [ ] Hiểu re-rendering cycle

### **✅ Kiến thức nâng cao:**
- [ ] Functional updates pattern
- [ ] Multiple useState vs single useState
- [ ] Form handling với useState
- [ ] API integration với useState

### **✅ Thực hành:**
- [ ] Xây dựng 3+ components sử dụng useState
- [ ] Kết nối với backend API
- [ ] Handle loading và error states
- [ ] Form validation với useState

---

**🎉 CHÚC MỪNG!** Bạn đã master useState trong 30 phút! 

**Bước tiếp theo:** Học `useEffect` để call API và handle side effects! 🚀

*useState là nền tảng của React - hiểu tốt useState = hiểu 70% React rồi!* ✨
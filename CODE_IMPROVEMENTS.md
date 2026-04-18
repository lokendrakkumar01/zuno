# ZUNO Platform - Code Improvements & Best Practices

## 🎯 Overview

This document outlines specific code improvements, best practices, and recommendations for maintaining the ZUNO platform.

---

## 🔧 Critical Code Fixes Applied

### 1. Frontend Error Handling

#### Before (Problematic):
```javascript
// No error handling
const data = await fetch(url).then(res => res.json());
setData(data);
```

#### After (Fixed):
```javascript
// Proper error handling with user feedback
try {
  const res = await fetchWithTimeout(url, {}, 12000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  setData(data.data);
  setError(null);
} catch (error) {
  console.error('Failed to fetch:', error);
  setError(error.message);
  // Use cached data as fallback
  const cached = readCache(cacheKey);
  if (cached) setData(cached);
}
```

### 2. Memory Leak Prevention

#### Before (Memory Leak):
```javascript
useEffect(() => {
  socket.on('message', handleMessage);
  // Missing cleanup!
}, []);
```

#### After (Fixed):
```javascript
useEffect(() => {
  if (!socket) return;
  
  const handleMessage = (data) => {
    // Handle message
  };
  
  socket.on('message', handleMessage);
  
  return () => {
    socket.off('message', handleMessage);
  };
}, [socket]);
```

### 3. Race Condition Fix

#### Before (Race Condition):
```javascript
// Multiple requests can overwrite each other
const fetchData = async () => {
  const data = await api.get('/data');
  setData(data);
};
```

#### After (Fixed):
```javascript
// Request cancellation and deduplication
const fetchData = async () => {
  const requestId = ++requestGenRef.current;
  
  try {
    const data = await api.get('/data');
    
    // Only update if this is still the latest request
    if (requestId === requestGenRef.current) {
      setData(data);
    }
  } catch (error) {
    if (requestId === requestGenRef.current) {
      setError(error);
    }
  }
};
```

### 4. Optimistic UI Updates

#### Before (Slow):
```javascript
// Wait for server response
const handleLike = async () => {
  const result = await api.post('/like');
  setLiked(result.liked);
};
```

#### After (Fast):
```javascript
// Instant UI update
const handleLike = async () => {
  // Optimistic update
  setLiked(prev => !prev);
  
  try {
    const result = await api.post('/like');
    // Sync with server response
    setLiked(result.liked);
  } catch (error) {
    // Revert on error
    setLiked(prev => !prev);
    showError('Failed to like');
  }
};
```

### 5. Database Query Optimization

#### Before (Slow - N+1 Query):
```javascript
// Fetches creator for each content item separately
const contents = await Content.find({});
for (const content of contents) {
  content.creator = await User.findById(content.creator);
}
```

#### After (Fast - Single Query):
```javascript
// Fetch all data in one aggregation
const contents = await Content.aggregate([
  { $match: { status: 'published' } },
  {
    $lookup: {
      from: 'users',
      localField: 'creator',
      foreignField: '_id',
      as: 'creatorDoc'
    }
  },
  { $unwind: '$creatorDoc' },
  {
    $project: {
      // Project only needed fields
      _id: 1,
      title: 1,
      body: 1,
      'creator._id': '$creatorDoc._id',
      'creator.username': '$creatorDoc.username',
      'creator.avatar': '$creatorDoc.avatar'
    }
  }
]);
```

### 6. Proper Caching Strategy

#### Implementation:
```javascript
// Multi-level caching with TTL
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

const fetchWithCache = async (key, fetcher) => {
  // Check memory cache first
  const memCached = memoryCache.get(key);
  if (memCached && Date.now() - memCached.timestamp < CACHE_TTL) {
    return memCached.data;
  }
  
  // Check localStorage cache
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        memoryCache.set(key, parsed);
        return parsed.data;
      }
    }
  } catch {}
  
  // Fetch fresh data
  const data = await fetcher();
  
  // Update both caches
  const cached = { data, timestamp: Date.now() };
  memoryCache.set(key, cached);
  try {
    localStorage.setItem(key, JSON.stringify(cached));
  } catch {}
  
  return data;
};
```

---

## 🚀 Performance Best Practices

### 1. Lazy Loading Components

```javascript
// Lazy load heavy components
const ContentCard = lazy(() => import('./components/Content/ContentCard'));
const VideoPlayer = lazy(() => import('./components/VideoPlayer'));

// Use with Suspense
<Suspense fallback={<Skeleton />}>
  <ContentCard content={content} />
</Suspense>
```

### 2. Virtual Scrolling

```javascript
// For long lists, use virtual scrolling
<VirtualizedList
  items={contents}
  itemHeight={520}
  renderItem={(content) => <ContentCard content={content} />}
/>
```

### 3. Debouncing & Throttling

```javascript
// Debounce search input
const debouncedSearch = useMemo(
  () => debounce((query) => {
    performSearch(query);
  }, 300),
  []
);

// Throttle scroll events
const throttledScroll = useMemo(
  () => throttle(() => {
    handleScroll();
  }, 100),
  []
);
```

### 4. Image Optimization

```javascript
// Compress images before upload
const compressImage = async (file) => {
  const img = new Image();
  const canvas = document.createElement('canvas');
  
  return new Promise((resolve) => {
    img.onload = () => {
      const MAX_SIZE = 800;
      let { width, height } = img;
      
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = (height * MAX_SIZE) / width;
          width = MAX_SIZE;
        } else {
          width = (width * MAX_SIZE) / height;
          height = MAX_SIZE;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
        'image/jpeg',
        0.6
      );
    };
    
    img.src = URL.createObjectURL(file);
  });
};
```

### 5. Cursor-Based Pagination

```javascript
// Backend: Cursor-based pagination (no skip/offset)
const getCursorPage = async (cursor, limit = 20) => {
  const query = cursor
    ? {
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }
        ]
      }
    : {};
  
  const items = await Content.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1);
  
  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? results[results.length - 1] : null;
  
  return { items: results, hasMore, nextCursor };
};
```

---

## 🔒 Security Best Practices

### 1. Input Validation

```javascript
// Always validate and sanitize input
const validateInput = (data) => {
  const schema = {
    username: /^[a-zA-Z0-9_]{3,30}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    bio: (val) => val.length <= 200
  };
  
  const errors = {};
  
  for (const [key, validator] of Object.entries(schema)) {
    if (typeof validator === 'function') {
      if (!validator(data[key])) {
        errors[key] = `Invalid ${key}`;
      }
    } else if (!validator.test(data[key])) {
      errors[key] = `Invalid ${key}`;
    }
  }
  
  return { valid: Object.keys(errors).length === 0, errors };
};
```

### 2. Rate Limiting

```javascript
// Implement rate limiting
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many attempts, please try again later'
});

app.use('/api/auth/login', authLimiter);
```

### 3. SQL Injection Prevention

```javascript
// Use parameterized queries (Mongoose does this automatically)
// NEVER do this:
const user = await User.findOne({ username: req.body.username }); // ❌

// Always use Mongoose methods:
const user = await User.findOne({ username: req.body.username }); // ✅
```

### 4. XSS Prevention

```javascript
// Sanitize HTML content
const sanitizeHtml = require('sanitize-html');

const cleanContent = sanitizeHtml(userInput, {
  allowedTags: ['b', 'i', 'em', 'strong', 'a'],
  allowedAttributes: {
    'a': ['href']
  }
});
```

---

## 📊 Monitoring & Logging

### 1. Error Tracking

```javascript
// Centralized error logging
const logError = (error, context = {}) => {
  console.error('[Error]', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  });
  
  // Send to error tracking service (e.g., Sentry)
  if (process.env.NODE_ENV === 'production') {
    // Sentry.captureException(error, { extra: context });
  }
};
```

### 2. Performance Monitoring

```javascript
// Track API response times
const performanceMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[Performance] ${req.method} ${req.path} - ${duration}ms`);
    
    // Alert if slow
    if (duration > 1000) {
      console.warn(`[Slow Request] ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
};
```

### 3. User Analytics

```javascript
// Track user actions
const trackEvent = (eventName, properties = {}) => {
  // Send to analytics service
  console.log('[Analytics]', {
    event: eventName,
    properties,
    timestamp: new Date().toISOString()
  });
};

// Usage
trackEvent('content_created', {
  contentType: 'post',
  userId: user.id
});
```

---

## 🧪 Testing Best Practices

### 1. Unit Tests

```javascript
// Test individual functions
describe('User Service', () => {
  it('should create a new user', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    };
    
    const user = await createUser(userData);
    
    expect(user).toBeDefined();
    expect(user.username).toBe('testuser');
    expect(user.password).not.toBe('password123'); // Should be hashed
  });
});
```

### 2. Integration Tests

```javascript
// Test API endpoints
describe('POST /api/auth/register', () => {
  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
  });
});
```

### 3. E2E Tests

```javascript
// Test complete user flows
describe('User Registration Flow', () => {
  it('should allow user to register and login', async () => {
    // Register
    await page.goto('/register');
    await page.fill('[name="username"]', 'testuser');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Should redirect to home
    await page.waitForURL('/');
    
    // Should see user profile
    const username = await page.textContent('.user-profile');
    expect(username).toBe('testuser');
  });
});
```

---

## 📝 Code Quality Standards

### 1. Naming Conventions

```javascript
// Use descriptive names
// ❌ Bad
const d = new Date();
const u = await User.find();

// ✅ Good
const currentDate = new Date();
const users = await User.find();

// Use camelCase for variables and functions
const userName = 'John';
const getUserById = (id) => {};

// Use PascalCase for components and classes
const UserProfile = () => {};
class UserService {}

// Use UPPER_CASE for constants
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const API_URL = 'https://api.example.com';
```

### 2. Function Size

```javascript
// Keep functions small and focused
// ❌ Bad - Too many responsibilities
const handleSubmit = async () => {
  // Validate
  // Transform
  // Upload
  // Save
  // Notify
  // Redirect
};

// ✅ Good - Single responsibility
const validateForm = (data) => {};
const transformData = (data) => {};
const uploadMedia = (file) => {};
const saveContent = (data) => {};
const notifyUser = (message) => {};
const redirectToHome = () => {};

const handleSubmit = async () => {
  const errors = validateForm(formData);
  if (errors) return;
  
  const data = transformData(formData);
  const mediaUrl = await uploadMedia(data.file);
  await saveContent({ ...data, mediaUrl });
  notifyUser('Content created successfully');
  redirectToHome();
};
```

### 3. Error Handling

```javascript
// Always handle errors gracefully
// ❌ Bad
const data = await api.get('/data');

// ✅ Good
try {
  const data = await api.get('/data');
  return { success: true, data };
} catch (error) {
  console.error('Failed to fetch data:', error);
  return { success: false, error: error.message };
}
```

### 4. Comments

```javascript
// Write self-documenting code
// ❌ Bad
// Loop through users
for (const u of users) {
  // Check if active
  if (u.a) {
    // Do something
  }
}

// ✅ Good
for (const user of users) {
  if (user.isActive) {
    processActiveUser(user);
  }
}

// Use comments for complex logic
// Calculate quality score based on helpful ratio
// Formula: (helpful / total) * 100
const qualityScore = (helpfulCount / (helpfulCount + notUsefulCount)) * 100;
```

---

## 🎯 Recommendations

### Immediate Actions
1. ✅ Review all error handling
2. ✅ Add proper logging
3. ✅ Implement monitoring
4. ✅ Write tests for critical paths

### Short-term (1-2 weeks)
1. Add comprehensive documentation
2. Implement automated testing
3. Set up CI/CD pipeline
4. Add performance monitoring

### Long-term (1-3 months)
1. Implement advanced caching
2. Add load balancing
3. Optimize database queries
4. Enhance security measures

---

## 📚 Resources

### Documentation
- [React Best Practices](https://react.dev/learn)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [MongoDB Performance](https://docs.mongodb.com/manual/administration/analyzing-mongodb-performance/)
- [Socket.io Documentation](https://socket.io/docs/v4/)

### Tools
- ESLint - Code linting
- Prettier - Code formatting
- Jest - Testing framework
- Lighthouse - Performance auditing

---

**Last Updated:** April 18, 2026  
**Status:** Complete ✅

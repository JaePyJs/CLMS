/**
 * Custom processor functions for Artillery load testing
 * Provides data generation, validation, and custom logic for CLMS tests
 */

// Generate random student data
function generateStudentData(userContext, events, done) {
  const grades = ['GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6'];
  const sections = ['A', 'B', 'C', 'D'];

  const student = {
    lrn: `LRN${Math.random().toString().substr(2, 12)}`,
    name: `Test Student ${Math.random().toString(36).substr(2, 9)}`,
    grade: grades[Math.floor(Math.random() * grades.length)],
    section: sections[Math.floor(Math.random() * sections.length)],
    email: `student${Math.random().toString(36).substr(2, 9)}@test.com`,
    phone: `09${Math.random().toString().substr(2, 9)}`,
  };

  userContext.vars.studentData = student;
  return done();
}

// Generate random book data
function generateBookData(userContext, events, done) {
  const categories = ['Fiction', 'Non-Fiction', 'Science', 'History', 'Technology'];
  const statuses = ['AVAILABLE', 'CHECKED_OUT', 'MAINTENANCE'];

  const book = {
    accessionNumber: `ACC${Math.random().toString().substr(2, 8)}`,
    title: `Test Book ${Math.random().toString(36).substr(2, 9)}`,
    author: `Test Author ${Math.random().toString(36).substr(2, 9)}`,
    category: categories[Math.floor(Math.random() * categories.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    isbn: `978-${Math.random().toString().substr(2, 10)}-${Math.random().toString().substr(2, 1)}`,
  };

  userContext.vars.bookData = book;
  return done();
}

// Generate random equipment data
function generateEquipmentData(userContext, events, done) {
  const types = ['COMPUTER', 'PRINTER', 'PROJECTOR', 'TABLET', 'CAMERA'];
  const statuses = ['AVAILABLE', 'IN_USE', 'MAINTENANCE'];

  const equipment = {
    name: `Test Equipment ${Math.random().toString(36).substr(2, 9)}`,
    type: types[Math.floor(Math.random() * types.length)],
    brand: 'TestBrand',
    model: `Model-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    serialNumber: `SN${Math.random().toString().substr(2, 10).toUpperCase()}`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    location: `Room ${Math.floor(Math.random() * 20) + 1}`,
  };

  userContext.vars.equipmentData = equipment;
  return done();
}

// Generate random barcode
function generateBarcode(userContext, events, done) {
  const barcode = Math.random().toString().substr(2, 13).padEnd(13, '0');
  userContext.vars.barcode = barcode;
  return done();
}

// Log performance metrics
function logPerformanceMetrics(requestContext, events, done) {
  const { response } = requestContext;

  if (response) {
    const { statusCode, responseTime } = response;

    // Log slow responses
    if (responseTime > 1000) {
      console.log(`[SLOW] ${requestContext.url} - ${responseTime}ms - Status: ${statusCode}`);
    }

    // Log errors
    if (statusCode >= 400) {
      console.log(`[ERROR] ${requestContext.url} - Status: ${statusCode} - Time: ${responseTime}ms`);
    }
  }

  return done();
}

// Validate response
function validateResponse(requestContext, events, done) {
  const { response } = requestContext;

  if (response && response.statusCode >= 400) {
    console.error(`Response validation failed for ${requestContext.url}:`, {
      statusCode: response.statusCode,
      body: response.body,
      headers: response.headers,
    });
  }

  return done();
}

// Add authentication token to requests
function addAuthHeader(requestParams, context, ee, next) {
  const token = context.vars.authToken || 'test-token-123';

  if (!requestParams.headers) {
    requestParams.headers = {};
  }

  requestParams.headers['Authorization'] = `Bearer ${token}`;

  return next();
}

// Add correlation ID for tracing
function addCorrelationId(requestParams, context, ee, next) {
  const correlationId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  if (!requestParams.headers) {
    requestParams.headers = {};
  }

  requestParams.headers['X-Correlation-ID'] = correlationId;
  requestParams.headers['X-Request-ID'] = correlationId;

  return next();
}

// Handle response errors
function handleErrors(requestContext, events, done) {
  const { response } = requestContext;

  if (response && response.statusCode >= 500) {
    console.error(`Server error for ${requestContext.url}:`, response.statusCode);
  } else if (response && response.statusCode === 429) {
    console.warn(`Rate limited for ${requestContext.url}`);
  }

  return done();
}

// Custom functions for CLMS-specific scenarios
function beforeRequest(requestParams, context, ee, next) {
  // Add custom headers
  if (!requestParams.headers) {
    requestParams.headers = {};
  }

  requestParams.headers['X-Test-Run'] = 'true';
  requestParams.headers['X-Test-Scenario'] = context.vars.scenario || 'unknown';

  return next();
}

function afterResponse(requestContext, events, done) {
  const { response, url } = requestContext;

  if (response) {
    // Log response time percentiles
    if (response.responseTime > 2000) {
      console.log(`[VERY_SLOW] ${url} - ${response.responseTime}ms`);
    }
  }

  return done();
}

// Export the processor functions
module.exports = {
  generateStudentData,
  generateBookData,
  generateEquipmentData,
  generateBarcode,
  logPerformanceMetrics,
  validateResponse,
  addAuthHeader,
  addCorrelationId,
  handleErrors,
  beforeRequest,
  afterResponse,
};
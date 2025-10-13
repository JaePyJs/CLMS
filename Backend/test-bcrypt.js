const bcrypt = require('bcryptjs');

async function testPassword() {
  const plainPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  console.log('Plain password:', plainPassword);
  console.log('Hashed password:', hashedPassword);

  const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
  console.log('Password match:', isMatch);

  // Test with actual admin hash from database
  const actualHash =
    '$2a$12$6OIIg8Y3Q1S2Z4H0h6Q8qO8k9Xv2P3M4N5O6P7Q8R9S0T1U2V3W4X5';
  const testMatch = await bcrypt.compare(plainPassword, actualHash);
  console.log('Match with test hash:', testMatch);
}

testPassword().catch(console.error);

import bcrypt from 'bcryptjs';

const run = async () => {
  const password1 = await bcrypt.hash('admin123', 10);
  const password2 = await bcrypt.hash('admin1234', 10);

  console.log('Admin1:', password1);
  console.log('Admin2:', password2);
};

run();
import app from './app.js';

const PORT = process.env.PORT ?? '3000';

app.listen(Number(PORT), () => {
  console.log(`{{PROJECT_NAME}} listening on port ${PORT}`);
});

import { env } from './config/env';
import { app } from './app';

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Servidor backend BenchOS rodando em http://localhost:${env.PORT}`);
});

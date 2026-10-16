import { emitKeypressEvents } from 'node:readline';
import { hashPassword } from '../lib/auth/password';

async function main(): Promise<void> {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal so the password is not echoed.');
  }

  emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  process.stdout.write('Enter a password (minimum 12 characters): ');

  const password = await new Promise<string>((resolve, reject) => {
    let value = '';
    const handleKeypress = (
      character: string,
      key: { name?: string; ctrl?: boolean; meta?: boolean }
    ) => {
      if (key.ctrl && key.name === 'c') {
        input.setRawMode(false);
        input.pause();
        input.off('keypress', handleKeypress);
        reject(new Error('Password generation cancelled.'));
        return;
      }

      if (key.name === 'return') {
        input.setRawMode(false);
        input.pause();
        input.off('keypress', handleKeypress);
        process.stdout.write('\n');
        resolve(value);
        return;
      }

      if (key.name === 'backspace') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }

      if (character && !key.ctrl && !key.meta) {
        value += character;
        process.stdout.write('*');
      }
    };
    input.on('keypress', handleKeypress);
  });

  process.stdout.write(`AUTH_PASSWORD_HASH=${await hashPassword(password)}\n`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Password hash generation failed.');
  process.exitCode = 1;
});

import { Instrument_Sans, Instrument_Serif } from 'next/font/google';
import './globals.css';

const sans = Instrument_Sans({ subsets: ['latin'], variable: '--sans' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--serif' });

export const metadata = {
  title: 'PR Diff Sentinel',
  description: 'A merge gate for secrets that remain in a pull request diff or git history.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}

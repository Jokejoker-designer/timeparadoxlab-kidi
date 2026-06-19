import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TimeParadoxLab } from './components/TimeParadoxLab';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');
createRoot(root).render(
  <StrictMode>
    <TimeParadoxLab />
  </StrictMode>,
);

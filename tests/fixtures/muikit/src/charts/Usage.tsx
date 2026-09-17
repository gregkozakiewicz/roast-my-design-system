import Box from '@mui/material/Box';
import { PieChart } from 'recharts';

const SERIES = ['#1de9b6', '#7c4dff', '#ffb200'];

export function Usage() {
  return <Box><PieChart data={SERIES} /></Box>;
}

import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

export function Card12() {
  const theme = useTheme();
  return <Box sx={{ color: 'text.secondary', p: 3 }}>Card 12</Box>;
}

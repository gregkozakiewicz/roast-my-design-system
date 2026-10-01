import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

export function Card30() {
  const theme = useTheme();
  return <Box sx={{ color: 'text.secondary', p: 3 }}>Card 30</Box>;
}

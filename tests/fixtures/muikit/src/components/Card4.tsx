import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

export function Card4() {
  const theme = useTheme();
  return <Box sx={{ color: '#667085', p: '12px', lineHeight: '16px' }}>Card 4</Box>;
}

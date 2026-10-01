import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

export function Card7() {
  const theme = useTheme();
  return <Box sx={{ color: theme.palette.text.secondary || '#667085', p: 3 }}>Card 7</Box>;
}

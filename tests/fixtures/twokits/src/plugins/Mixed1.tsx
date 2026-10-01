import Box from '@mui/material/Box';
import { Card, Text } from '@backstage/ui';

export function Mixed1() {
  return (
    <Box sx={{ p: '20px', m: '8px', color: '#667085', bgcolor: '#3355ff' }}>
      <Card style={{ padding: '14px' }}>
        <Text>Mixed 1</Text>
      </Card>
    </Box>
  );
}

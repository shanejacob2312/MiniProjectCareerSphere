import React from 'react';
import { Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: theme.zIndex.drawer + 1,
}));

const Navbar = () => {
  return (
    <StyledAppBar position="fixed">
      <Toolbar>
        <Typography 
          variant="h6" 
          component={Link} 
          to="/dashboard" 
          sx={{ 
            flexGrow: 1, 
            textDecoration: 'none', 
            color: 'inherit',
            fontWeight: 'bold'
          }}
        >
          CareerSphere
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            color="inherit" 
            component={Link} 
            to="/dashboard"
            sx={{ 
              '&:hover': { 
                backgroundColor: 'rgba(255, 255, 255, 0.1)' 
              }
            }}
          >
            Dashboard
          </Button>
          <Button 
            color="inherit" 
            component={Link} 
            to="/resumeinput"
            sx={{ 
              '&:hover': { 
                backgroundColor: 'rgba(255, 255, 255, 0.1)' 
              }
            }}
          >
            Create Resume
          </Button>
          <Button 
            color="inherit" 
            component={Link} 
            to="/uploadresume"
            sx={{ 
              '&:hover': { 
                backgroundColor: 'rgba(255, 255, 255, 0.1)' 
              }
            }}
          >
            Upload Resume
          </Button>
        </Box>
      </Toolbar>
    </StyledAppBar>
  );
};

export default Navbar;

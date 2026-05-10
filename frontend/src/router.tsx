import { createBrowserRouter } from 'react-router'
import App from './App'
import { HomePage } from './pages/HomePage'
import { EditorPage } from './pages/EditorPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'editor/:designId', element: <EditorPage /> },
    ],
  },
])

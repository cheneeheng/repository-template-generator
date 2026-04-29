import { Routes, Route } from 'react-router-dom'
import TemplatePickerPage from './pages/TemplatePickerPage.jsx'
import ConfigurePage from './pages/ConfigurePage.jsx'
import PreviewPage from './pages/PreviewPage.jsx'
import ExportPage from './pages/ExportPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TemplatePickerPage />} />
      <Route path="/configure" element={<ConfigurePage />} />
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="/export" element={<ExportPage />} />
    </Routes>
  )
}

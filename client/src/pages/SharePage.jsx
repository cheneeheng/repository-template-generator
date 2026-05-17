import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function SharePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`/api/share/${id}`)
      .then(async (res) => {
        if (res.status === 404 || res.status === 410) { setError('not_found'); return }
        if (!res.ok) { setError('unknown'); return }
        const data = await res.json()
        navigate('/preview', {
          state: { fileTree: data.fileTree, projectName: data.projectName, templateId: data.templateId, fromShare: true },
          replace: true,
        })
      })
      .catch(() => setError('unknown'))
  }, [id, navigate])

  if (error === 'not_found') {
    return (
      <div>
        <p>This link was not found or has expired (links last 24 hours).</p>
        <button onClick={() => navigate('/')}>Start a new project</button>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <p>Something went wrong loading this link.</p>
        <button onClick={() => navigate('/')}>Start a new project</button>
      </div>
    )
  }

  return (
    <div aria-live="polite">
      <p>Loading shared project&hellip;</p>
    </div>
  )
}

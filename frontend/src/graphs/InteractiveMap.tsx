import React, { useEffect, useState } from 'react'
import axios from 'axios'
import Plot from 'react-plotly.js'

interface CountrySummary {
  country: string
  iso_alpha_3: string
  total_contribution: number
  project_count: number
  latitude: number
  longitude: number
  log_contribution: number
  euro_per_100k_inhabitants?: number
}

interface Organization {
  id: string
  name: string
  latitude: number
  longitude: number
  iso_alpha_3: string
  activity_type?: string
  role?: string
}

interface Project {
  id: string
  acronym: string
  title: string
  ec_max_contribution: number
  start_year?: number
  field_class?: string[]
  field?: string[]
  sub_field?: string[]
  niche?: string[]
  funding_scheme?: string
  coordinator_name?: string
}

interface MapDataResponse {
  projects: Project[]
  organizations: Organization[]
  country_summary: CountrySummary[]
}

const InteractiveMap: React.FC = () => {
  // Filter state
  const [country, setCountry] = useState<string>('all')
  const [fundingScheme, setFundingScheme] = useState<string>('all')
  const [year, setYear] = useState<string>('all')
  const [fieldClass, setFieldClass] = useState<string[]>([])
  const [field, setField] = useState<string[]>([])
  const [subField, setSubField] = useState<string[]>([])
  const [niche, setNiche] = useState<string[]>([])
  const [activityType, setActivityType] = useState<string>('all')
  const [role, setRole] = useState<string>('all')
  const [perCapita, setPerCapita] = useState<boolean>(false)
  const [showNetwork, setShowNetwork] = useState<boolean>(false)
  const [showPins, setShowPins] = useState<boolean>(true)

  // Data state
  const [data, setData] = useState<MapDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dropdown options state
  const [countryOptions, setCountryOptions] = useState<string[]>([])
  const [fundingSchemeOptions, setFundingSchemeOptions] = useState<string[]>([])
  const [yearOptions, setYearOptions] = useState<string[]>([])
  const [fieldClassOptions, setFieldClassOptions] = useState<string[]>([])
  const [fieldOptions, setFieldOptions] = useState<string[]>([])
  const [subFieldOptions, setSubFieldOptions] = useState<string[]>([])
  const [nicheOptions, setNicheOptions] = useState<string[]>([])
  const [activityTypeOptions, setActivityTypeOptions] = useState<string[]>([])
  const [roleOptions, setRoleOptions] = useState<string[]>([])

  // Fetch data with filters
  useEffect(() => {
    setLoading(true)
    setError(null)
    // Build query string
    const params = new URLSearchParams()
    if (country !== 'all') params.append('country', country)
    if (fundingScheme !== 'all') params.append('funding_scheme', fundingScheme)
    if (year !== 'all') params.append('year', year)
    if (fieldClass.length > 0) params.append('field_class', fieldClass.join(','))
    if (field.length > 0) params.append('field', field.join(','))
    if (subField.length > 0) params.append('sub_field', subField.join(','))
    if (niche.length > 0) params.append('niche', niche.join(','))
    if (activityType !== 'all') params.append('activity_type', activityType)
    if (role !== 'all') params.append('role', role)

    axios.get<MapDataResponse>(`http://127.0.0.1:8000/map-data?${params.toString()}`)
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load map data'))
      .finally(() => setLoading(false))
  }, [country, fundingScheme, year, fieldClass, field, subField, niche, activityType, role])

  // Extract dropdown options from data
  useEffect(() => {
    if (!data) return
    setCountryOptions(Array.from(new Set(data.organizations.map(o => o.iso_alpha_3).filter(Boolean))))
    setFundingSchemeOptions(Array.from(new Set(data.projects.map(p => p.funding_scheme).filter(Boolean) as string[])))
    setYearOptions(Array.from(new Set(data.projects.map(p => p.start_year).filter(Boolean).map(String))))
    setFieldClassOptions(Array.from(new Set(data.projects.flatMap(p => p.field_class || []))))
    setFieldOptions(Array.from(new Set(data.projects.flatMap(p => p.field || []))))
    setSubFieldOptions(Array.from(new Set(data.projects.flatMap(p => p.sub_field || []))))
    setNicheOptions(Array.from(new Set(data.projects.flatMap(p => p.niche || []))))
    setActivityTypeOptions(Array.from(new Set(data.organizations.map(o => o.activity_type).filter(Boolean) as string[])))
    setRoleOptions(Array.from(new Set(data.organizations.map(o => o.role).filter(Boolean) as string[])))
  }, [data])

  // Prepare project table data
  const projectTableData = React.useMemo(() => {
    if (!data) return []
    // Get involved institutes as a comma-separated string
    const institutesPerProject: Record<string, string> = {}
    data.organizations.forEach(org => {
      if (!institutesPerProject[org.id]) institutesPerProject[org.id] = org.name
      else institutesPerProject[org.id] += ', ' + org.name
    })
    return data.projects.map(row => ({
      project_acronym: row.acronym,
      ec_max_contribution: row.ec_max_contribution,
      title: row.title,
      institutes: institutesPerProject[row.id] || ''
    }))
  }, [data])

  // Prepare map traces
  let mapTraces: any[] = []
  if (data) {
    // Country summary bubbles
    const countrySummary = data.country_summary
    const colorCol = perCapita ? countrySummary.map(c => c.euro_per_100k_inhabitants || 0) : countrySummary.map(c => c.log_contribution)
    mapTraces.push({
      type: 'scattergeo',
      mode: 'markers',
      lat: countrySummary.map(c => c.latitude),
      lon: countrySummary.map(c => c.longitude),
      text: countrySummary.map(
        c => `${c.country}<br>€${c.total_contribution.toLocaleString()}<br>Projects: ${c.project_count}`
      ),
      marker: {
        size: countrySummary.map(c => Math.sqrt(c.total_contribution) / 100), // adjust scaling as needed
        color: colorCol,
        colorscale: 'Viridis',
        colorbar: { title: perCapita ? '€ per 100k' : 'Log(Contribution)' },
        sizemode: 'area',
        opacity: 0.7,
      },
      name: 'Countries'
    })

    // Organization pins
    if (showPins) {
      mapTraces.push({
        type: 'scattergeo',
        mode: 'markers',
        lat: data.organizations.map(o => o.latitude),
        lon: data.organizations.map(o => o.longitude),
        text: data.organizations.map(o => o.name),
        marker: {
          size: 6,
          color: 'green',
          opacity: 0.4,
          symbol: 'circle'
        },
        name: 'Organizations'
      })
    }

    // Network lines (collaborations)
    if (showNetwork) {
      // For each project, draw lines between all pairs of organizations in that project
      const orgsByProject: Record<string, Organization[]> = {}
      data.organizations.forEach(org => {
        if (!orgsByProject[org.id]) orgsByProject[org.id] = []
        orgsByProject[org.id].push(org)
      })
      Object.entries(orgsByProject).forEach(([pid, orgs]) => {
        for (let i = 0; i < orgs.length; i++) {
          for (let j = i + 1; j < orgs.length; j++) {
            mapTraces.push({
              type: 'scattergeo',
              mode: 'lines',
              lat: [orgs[i].latitude, orgs[j].latitude],
              lon: [orgs[i].longitude, orgs[j].longitude],
              line: { width: 2, color: 'blue' },
              opacity: 0.4,
              hoverinfo: 'none',
              showlegend: false
            })
          }
        }
      })
    }
  }

  return (
    <div>
      <h3>Horizon Europe Project Funding Visualization</h3>
      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
        {/* First column */}
        <div style={{ flex: 1, margin: 10 }}>
          <label>Select Country:</label>
          <select value={country} onChange={e => setCountry(e.target.value)}>
            <option value="all">All</option>
            {countryOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <label>Select funding scheme:</label>
          <select value={fundingScheme} onChange={e => setFundingScheme(e.target.value)}>
            <option value="all">All</option>
            {fundingSchemeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <label>Select starting year:</label>
          <select value={year} onChange={e => setYear(e.target.value)}>
            <option value="all">All</option>
            {yearOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        {/* Second column */}
        <div style={{ flex: 1, margin: 10 }}>
          <label>Select field class:</label>
          <select multiple value={fieldClass} onChange={e => setFieldClass(Array.from(e.target.selectedOptions, o => o.value))}>
            {fieldClassOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <label>Select field:</label>
          <select multiple value={field} onChange={e => setField(Array.from(e.target.selectedOptions, o => o.value))}>
            {fieldOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <label>Select subfield:</label>
          <select multiple value={subField} onChange={e => setSubField(Array.from(e.target.selectedOptions, o => o.value))}>
            {subFieldOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <label>Select niche:</label>
          <select multiple value={niche} onChange={e => setNiche(Array.from(e.target.selectedOptions, o => o.value))}>
            {nicheOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        {/* Third column */}
        <div style={{ flex: 1, margin: 10 }}>
          <label>Select activity type:</label>
          <select value={activityType} onChange={e => setActivityType(e.target.value)}>
            <option value="all">All</option>
            {activityTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <label>Select organization role:</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="all">All</option>
            {roleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <div>
            <label>
              <input type="checkbox" checked={perCapita} onChange={e => setPerCapita(e.target.checked)} />
              Show per 100k inhabitants
            </label>
          </div>
          <div>
            <label>
              <input type="checkbox" checked={showNetwork} onChange={e => setShowNetwork(e.target.checked)} />
              Show collaboration network
            </label>
          </div>
          <div>
            <label>
              <input type="checkbox" checked={showPins} onChange={e => setShowPins(e.target.checked)} />
              Show organization pins
            </label>
          </div>
        </div>
      </div>
      {/* Map */}
      {loading ? <p>Loading…</p> : error ? <p style={{ color: 'red' }}>{error}</p> : (
        <Plot
          data={mapTraces}
          layout={{
            geo: {
              scope: 'world',
              showland: true,
              landcolor: '#EAEAAE',
              showcountries: true,
              countrycolor: '#d3d3d3',
              projection: { type: 'natural earth' }
            },
            margin: { t: 0, l: 0, r: 0, b: 0 },
            height: 700
          }}
          style={{ width: '100%', height: '700px' }}
        />
      )}
      {/* Project Table */}
      <h4>Projects shown on the map:</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Acronym</th>
            <th>EC Contribution</th>
            <th>Title</th>
            <th>Institutes</th>
          </tr>
        </thead>
        <tbody>
          {projectTableData.map((row, i) => (
            <tr key={i}>
              <td>{row.project_acronym}</td>
              <td>{row.ec_max_contribution?.toLocaleString()}</td>
              <td>{row.title}</td>
              <td>{row.institutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default InteractiveMap
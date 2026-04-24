import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getServiceClient } from '@/lib/api-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error
  const { id } = await params
  const db = getServiceClient()
  const url = new URL(req.url)
  const fiscal_year = url.searchParams.get('fiscal_year')

  let query = db
    .from('kaikei_issues')
    .select('*')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  if (fiscal_year) query = query.eq('fiscal_year', fiscal_year)

  const { data, error: err } = await query
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error
  const { id } = await params
  const body = await req.json()
  const db = getServiceClient()

  const { data, error: err } = await db
    .from('kaikei_issues')
    .insert({ ...body, client_id: id })
    .select()
    .single()

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error
  const { id: clientId } = await params
  const { issue_id, ...body } = await req.json()
  const db = getServiceClient()

  const { data, error: err } = await db
    .from('kaikei_issues')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', issue_id)
    .eq('client_id', clientId)
    .select()
    .single()

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error
  const { id: clientId } = await params
  const { issue_id } = await req.json()
  const db = getServiceClient()

  const { error: err } = await db
    .from('kaikei_issues')
    .delete()
    .eq('id', issue_id)
    .eq('client_id', clientId)

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

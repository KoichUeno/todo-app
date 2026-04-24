import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getServiceClient } from '@/lib/api-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAuth()
  if (error) return error
  const { id } = await params
  const db = getServiceClient()

  const { data, error: err } = await db
    .from('kaikei_client_settings')
    .select('*')
    .eq('client_id', id)
    .maybeSingle()

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
    .from('kaikei_client_settings')
    .upsert({ ...body, client_id: id, updated_at: new Date().toISOString() }, { onConflict: 'client_id' })
    .select()
    .single()

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json(data)
}

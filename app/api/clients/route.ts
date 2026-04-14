import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getServiceClient } from '@/lib/api-auth'

export async function GET() {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const { data, error } = await getServiceClient()
    .from('clients')
    .select('*')
    .order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { name, ...rest } = body
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const { data, error } = await getServiceClient()
    .from('clients')
    .insert({ name, ...rest })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { id, ...updates } = body
  const { data, error } = await getServiceClient()
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const { error } = await getServiceClient().from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

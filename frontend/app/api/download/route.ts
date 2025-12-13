import { NextRequest, NextResponse } from 'next/server';
import CONFIG from "@/lib/config";

export async function POST(request: NextRequest) {
  try {
    const { url, settings } = await request.json();

    if (!url || !url.trim()) {
      return NextResponse.json(
        { success: false, error: 'URL is missing' },
        { status: 400 }
      );
    }

    const response = await fetch(`${CONFIG.MAIN_SERVER}download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, settings }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.detail || 'Download error' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      message: data.message,
    });
  } catch (error) {
    console.error('Error in API /download:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}

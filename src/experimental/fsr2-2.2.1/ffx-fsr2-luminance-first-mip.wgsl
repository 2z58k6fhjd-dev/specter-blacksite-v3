// SPDX-License-Identifier: MIT
//
// Experimental WGSL port of one bounded AMD FidelityFX FSR2 2.2.1 operation.
// Upstream copyright (c) 2022-2023 Advanced Micro Devices, Inc.
// See LICENSE-AMD-FSR2.txt and PROVENANCE.json in this directory.
//
// IMPORTANT: This is only the first 2x2 FP32 log-luminance reduction used by
// AMD's Single Pass Downsampler (SPD) path. It is not the complete luminance
// pyramid, auto exposure, temporal upscaler, or an AMD-provided WebGPU port.

struct LuminanceFirstMipConstants {
    render_size: vec2<u32>,
    input_color_resource_dimensions: vec2<u32>,
    jitter: vec2<f32>,
    pre_exposure: f32,
    _padding: f32,
}

@group(0) @binding(0)
var input_color: texture_2d<f32>;

@group(0) @binding(1)
var input_color_linear_clamp: sampler;

@group(0) @binding(2)
var<uniform> pass_constants: LuminanceFirstMipConstants;

// R32_FLOAT deliberately preserves the upstream FP32 arithmetic path in this
// isolated reference. The production FSR2 resource plan uses R16_FLOAT for its
// selected current-luminance output; that resource plan is not implemented here.
@group(0) @binding(3)
var first_log_luminance_mip: texture_storage_2d<r32float, write>;

const FSR2_EPSILON: f32 = 1.0e-3;
const FSR2_RGB_TO_LUMA: vec3<f32> = vec3<f32>(0.2126, 0.7152, 0.0722);
const SPD_REDUCE_WEIGHT: f32 = 0.25;

// Direct WGSL translation of FSR2 2.2.1 ClampUv for this input texture.
fn clamp_uv(
    uv: vec2<f32>,
    texture_size: vec2<u32>,
    resource_size: vec2<u32>,
) -> vec2<f32> {
    let sample_location = uv * vec2<f32>(texture_size);
    let half_texel = vec2<f32>(0.5, 0.5);
    let clamped_location = max(
        half_texel,
        min(sample_location, vec2<f32>(texture_size) - half_texel),
    );
    return clamped_location / vec2<f32>(resource_size);
}

// Direct translation of the FP32 SpdLoadSourceImage luminance arithmetic.
fn source_log_luminance(source_texel: vec2<u32>) -> f32 {
    let texel = vec2<f32>(source_texel);
    var uv = (texel + vec2<f32>(0.5, 0.5) + pass_constants.jitter)
        / vec2<f32>(pass_constants.render_size);
    uv = clamp_uv(
        uv,
        pass_constants.render_size,
        pass_constants.input_color_resource_dimensions,
    );

    var rgb = textureSampleLevel(
        input_color,
        input_color_linear_clamp,
        uv,
        0.0,
    ).rgb;
    rgb = rgb / pass_constants.pre_exposure;

    let log_luminance = log(max(FSR2_EPSILON, dot(rgb, FSR2_RGB_TO_LUMA)));
    let is_on_screen = all(source_texel < pass_constants.render_size);
    return select(0.0, log_luminance, is_on_screen);
}

// Direct translation of the FSR2 callback SpdReduce4.
fn spd_reduce_4(v0: f32, v1: f32, v2: f32, v3: f32) -> f32 {
    return (v0 + v1 + v2 + v3) * SPD_REDUCE_WEIGHT;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let output_texel = global_id.xy;
    if (any(output_texel >= textureDimensions(first_log_luminance_mip))) {
        return;
    }

    let base_texel = output_texel * vec2<u32>(2u, 2u);
    let reduced = spd_reduce_4(
        source_log_luminance(base_texel + vec2<u32>(0u, 0u)),
        source_log_luminance(base_texel + vec2<u32>(0u, 1u)),
        source_log_luminance(base_texel + vec2<u32>(1u, 0u)),
        source_log_luminance(base_texel + vec2<u32>(1u, 1u)),
    );

    textureStore(
        first_log_luminance_mip,
        vec2<i32>(output_texel),
        vec4<f32>(reduced, 0.0, 0.0, 0.0),
    );
}

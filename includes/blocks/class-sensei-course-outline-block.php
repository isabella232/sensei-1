<?php
/**
 * File containing the Sensei_Course_Outline_Block class.
 *
 * @package sensei
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Sensei_Course_Outline_Block
 */
class Sensei_Course_Outline_Block {
	/**
	 * Sensei_Course_Outline_Block constructor.
	 */
	public function __construct() {
		add_action( 'enqueue_block_assets', [ $this, 'enqueue_assets' ] );
		add_action( 'init', [ $this, 'register_course_template' ], 101 );
		add_action( 'init', [ $this, 'register_block' ] );
		add_action( 'template_redirect', [ $this, 'skip_single_course_template' ], 5 );
	}

	/**
	 * Enqueue frontend and editor assets.
	 *
	 * @access private
	 */
	public function enqueue_assets() {
		if ( 'course' !== get_post_type() ) {
			return;
		}

		Sensei()->assets->enqueue( 'sensei-course-outline-script', 'blocks/course-outline/index.js' );
		Sensei()->assets->enqueue( 'sensei-course-outline-style', 'blocks/course-outline/style.css' );
	}

	/**
	 * Disable single course template for courses with Outline block.
	 */
	public function skip_single_course_template() {
		if ( is_single() && 'course' === get_post_type() && has_block( 'sensei-lms/course-outline' ) ) {
			remove_action( 'template_include', array( 'Sensei_Templates', 'template_loader' ), 10 );
			remove_action( 'template_redirect', array( 'Sensei_Unsupported_Themes', 'init' ) );

			add_filter(
				'the_content',
				function( $content ) {
					ob_start();
					do_action( 'sensei_single_course_content_inside_before', get_the_ID() );
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Buffered.
					echo $content;
					do_action( 'sensei_single_course_content_inside_after', get_the_ID() );

					return ob_get_clean();
				}
			);

		}

	}

	/**
	 * Register course template.
	 *
	 * @access private
	 */
	public function register_course_template() {
		$post_type_object = get_post_type_object( 'course' );

		$post_type_object->template = [
			[ 'sensei-lms/course-outline' ],
		];
	}

	/**
	 * Register course outline block.
	 *
	 * @access private
	 */
	public function register_block() {
		register_block_type(
			'sensei-lms/course-outline',
			[
				'render_callback' => [ $this, 'render_callback' ],
				'attributes'      => [
					'id'     => [
						'type' => 'int',
					],
					'blocks' => [
						'type' => 'object',
					],
				],
			]
		);
	}

	/**
	 * Add attributes to inner blocks from the Outline block.
	 *
	 * @param array $structure  Course structure.
	 * @param array $attributes Outline block attributes.
	 */
	private static function add_block_attributes( &$structure, $attributes ) {
		if ( empty( $structure ) ) {
			return;
		}
		$block_attributes = $attributes['blocks'] ?? [];
		foreach ( $structure as &$block ) {
			$block['attributes'] = $block_attributes[ $block['type'] . '-' . $block['id'] ] ?? [];
			self::add_block_attributes( $block['lessons'], $attributes );
		}
	}

	/**
	 * Render dynamic block.
	 *
	 * @access private
	 *
	 * @param array $attributes Block attributes.
	 *
	 * @return string Block HTML.
	 */
	public function render_callback( $attributes ) {

		global $post;

		$structure = Sensei_Course_Structure::instance( $post->ID )->get();

		$this->disable_course_legacy_content();

		self::add_block_attributes( $structure, $attributes );

		$block_class = 'wp-block-sensei-lms-course-outline';
		if ( isset( $attributes['className'] ) ) {
			$block_class .= ' ' . $attributes['className'];
		}

		return '		
			<section class="' . $block_class . '">
				' .
			implode(
				'',
				array_map(
					function( $block ) {
						if ( 'module' === $block['type'] ) {
							return $this->get_module_block_html( $block );
						}

						if ( 'lesson' === $block['type'] ) {
							return $this->get_lesson_block_html( $block );
						}
					},
					$structure
				)
			)
			. '
			</section>
		';
	}

	/**
	 * Get lesson block HTML.
	 *
	 * @param array $block Block information.
	 *
	 * @return string Lesson HTML
	 */
	private function get_lesson_block_html( $block ) {
		return '
			<a class="wp-block-sensei-lms-course-outline-lesson" href="#">
				' . $block['title'] . '
			</a>
		';
	}

	/**
	 * Get module block HTML.
	 *
	 * @param array $block Block information.
	 *
	 * @return string Module HTML
	 */
	private function get_module_block_html( $block ) {
		if ( empty( $block['lessons'] ) ) {
			return '';
		}
		return '
			<section class="wp-block-sensei-lms-course-outline-module">
				<header class="wp-block-sensei-lms-course-outline-module__name">
					<h2 class="wp-block-sensei-lms-course-outline__clean-heading">' . $block['title'] . '</h2>
				</header>
				<div class="wp-block-sensei-lms-course-outline-module__description">
					' . $block['description'] . '
				</div>
						<div class="wp-block-sensei-lms-course-outline-module__lessons-title">
							<h3 class="wp-block-sensei-lms-course-outline__clean-heading">' . __( 'Lessons', 'sensei-lms' ) . '</h3>
						</div>
					' .
			implode(
				'',
				array_map(
					[ $this, 'get_lesson_block_html' ],
					$block['lessons']
				)
			)
			. '
			</section>
		';
	}

	/**
	 * Disable course legacy content.
	 */
	private function disable_course_legacy_content() {
		// TODO: Check the best approach for backwards compatibility.
		remove_action( 'sensei_single_course_content_inside_before', array( 'Sensei_Course', 'the_title' ), 10 );
		remove_action( 'sensei_single_course_content_inside_after', 'course_single_lessons' );
		remove_action( 'sensei_single_course_content_inside_after', [ 'Sensei_Course', 'the_course_lessons_title' ], 9 );
		remove_action( 'sensei_single_course_content_inside_after', [ Sensei()->modules, 'load_course_module_content_template' ], 8 );
	}

}
